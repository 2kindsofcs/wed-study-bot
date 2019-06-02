const {WebClient} = require('@slack/client');
const express = require('express');
const bodyParser = require('body-parser'); // 외부 라이브러리를 가급적 앞쪽에 써주자
const config = require('config');
const {dateToString, addDays} = require('./date_utils');
const {botMessage} = require('./message_template');
const {messageCal} = require('./calculate');
const db = require('./db');

const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.get('/test', (req, res) => {
  res.status(200);
  res.write('It running!');
  res.end();
});

if (config.has('http.https')) {
  const path = require('path');
  const https = require('https');
  const fs = require('fs'); // file system
  const privateKey = fs.readFileSync(
      path.resolve(config.get('http.https.key')),
      'utf-8'
  );
  const certificate = fs.readFileSync(
      path.resolve(config.get('http.https.cert')),
      'utf-8'
  );
  const ca = fs.readFileSync(
      path.resolve(config.get('http.https.ca')),
      'utf-8'
  );
  const httpsServer = https.createServer(
      {key: privateKey, cert: certificate, ca: ca},
      app
  );
  httpsServer.listen(443, () => console.log('HTTPS server started'));
  // 이제 traefik을 사용하게 되었으므로 사실 https 부분은 더 이상 쓸 필요가 없다.
  // 바로 밑의 else 이하로 넘어가게 될 것이다. 다만 참고용으로 남겨둔다.
} else {
  const http = require('http');
  const httpServer = http.createServer(app);
  httpServer.listen(
      parseInt(config.get('http.port'), 10),
      () => console.log('HTTP server started')
  );
}

// db와 관련된 명령은 await을 해야 실행시킬 수 있으므로 async 추가
app.post('/', async (req, res) => { // user가 참석 또는 불참 버튼을 클릭
  try {
    // webClient를 하나만 만들라는 법은 없다. 어차피 슬랙 서버는 다 똑같이 취급할 것이다.
    const web = new WebClient(config.get('chat_token'));
    const data = JSON.parse(req.body.payload);
    const [response, dateString] = data.actions[0].value.split('_');
    console.log(response, dateString);
    // post 요청이 날아온 시각을 확인하는 방법도 있겠지만, 어차피 크론이 6시에 예약을 시킬 것이므로
    // db를 확인해서(예약완료시 price에 가격이 기입될테니까) null이 아니면 요청 무시!
    if (await db('round_info').where({
      study_date: dateString, price: null,
    })) {
      const userId = data.user.id;
      const isAttending = response === 'attend';
      // 조건을 추가하고 싶을 때 계속 추가하다보면 if 밑에 또 if...식으로 너무 복잡해지므로
      // 이럴 때 쓰는 방법 중 하나가 역으로 if(!조건)하고 아무 일도 하지 않는 것.
      if (isAttending) {
        await db('rsvp').where(
            {member_name: userId, study_date: dateString}
        ).update({attending: true});
      } else {
        await db('rsvp').where(
            {member_name: userId, study_date: dateString}
        ).update({attending: false});
      }
      const rsvp = await db('rsvp').where(
          {study_date: dateString}
      ).select('member_name', 'attending');
      // [{member_name:"3423", attending:"1"}, {}]
      const members = {
        attend: [],
        absent: [],
        no_response: [],
      };
      // Q.왜 const죠? let이어만 할 것 같은데요.
      // A.for문 블록 안에서만 유효한 변수입니다!
      // for ~ of의 경우 블록 안에서 변경되지 않으면 const를 쓰세요
      for (const row of rsvp) {
        switch (row.attending) {
          case 1: // 디버깅을 할 때는 코드보다도 올바른 값이 전달되고 있는지를 확인. true가 아니라 1이었다!
            members.attend.push(row.member_name);
            break;
          case 0:
            members.absent.push(row.member_name);
            break;
          case null:
            members.no_response.push(row.member_name);
            break;
        }
      }
      let remindList = [];
      // 참석자 수 + 불참자 수 >= 전체 인원/2를 정리하면 아래와 같은 식이 된다
      if (members.attend + members.absent >= members.no_response) {
        remindList = members.no_response;
      }
      const ts = data.container.message_ts;
      console.log(`<@${userId}> is ${isAttending ? 'attending' : 'absent'}`);
      web.chat.update(
          {
            ts: ts,
            // 이미 유효한 요청인지 검증되었으므로 해당 메세지의 channel id 그대로 쓰면 됨
            channel: data.channel.id,
            text: '',
            as_user: true,
            blocks: botMessage(
                members.attend,
                members.absent,
                remindList,
                dateString),
          } // 빠져있던 dateString 추가
      );
      res.status(200);
    } else {
      console.log("round_info 맞는 조건이 없읍니다");
      res.status(404);
    }
    res.end();
  } catch (e) {
    console.log(e);
  }
});

/**
 * @noreturns
 */
async function studyPoll() {
  try {
    // cron이 이 함수를 실행할 때 dateString은 최초로 만들어진다.
    // 그리고 message에 박제되므로 유저가 버튼 누를 때 해당 메세지에 들어있는
    // dateString은 cron이 이 함수를 실행한 날짜이다.
    const dateString = dateToString(addDays(new Date(), 3));
    const web = new WebClient(config.get('chat_token'));
    const channel = (await web.conversations.list()).
        channels.filter((el) => (el.name_normalized === 'general'));
    if (!channel) {
      console.log('그런 거 없다');
      return;
    }
    const channel_id = channel[0].id;
    // Q.어차피 cron으로 일주일에 한번씩 돌릴건데 왜 확인을 해야하죠?
    // A.만약 서버가 꺼졌다 다시 켜진다거나 하는 상황에서 동일한 메세지가
    // 계속 채팅방에 뿌려지는 것을 막을 수 있고, db에 insert되는 것도 막을 수 있음.
    const roundCount = await db('round_info').where(
        {study_date: dateString}
    ).count('*');
    console.log(roundCount);
    if (roundCount[0]['count(*)'] !== 0) {
      console.log(`이미 있단다 깔깔깔`);
      return;
    }
    web.chat.postMessage({
      channel: `${channel.id}`,
      text: '',
      as_user: true,
      blocks: botMessage([], [], [], dateString),
    });
    // 일단 가격은 모르니까(수요조사 전이므로) 스터디 날짜만 저장
    await db('round_info').insert({study_date: dateString});
    let membersList = (await web.conversations.members({
      channel: channel_id,
    })).members;
    // bot은 제외시킨다.
    membersList = membersList.filter((mem) => (mem !== 'UH3CD2TQA'));
    // 스터디 날짜와 멤버들 이름만 저장
    await db('rsvp').insert(
        membersList.map((name)=>({study_date: dateString, member_name: name}))
    );
  } catch (e) {
    console.log(e);
  }
} // 함수는 끝에 세미콜론 없어

/**
 * @noreturns
 */
async function calculate() {
  try {
    const web = new WebClient(config.get('chat_token'));
    const channel = await web.conversations.list().
        channels.filter((el) => (el.name_normalized === 'general'));
    const dateString = dateToString(new Date());
    const totalPrice = await db('round_info').where(
        {studydate: dateString}
    ).select('price');
    const rsvp = await db('rsvp').where(
        {study_date: dateString}
    ).select('member_name', 'attending');
    const attended = [];
    for (const row of rsvp) {
      if (row.attending === 1) {
        attended.push(row.member_name);
      }
    }
    const charge = parseInt(totalPrice.price / attended.length);
    web.chat.postMessage({
      channel: `${channel.id}`,
      text: '',
      as_user: true,
      blocks: messageCal(attended, charge, dateString),
    });
  } catch (e) {
    console.log(e);
  }
}

// index에서는 study_poll 파일 자체를 받는데 이건 또 왜 익스포트하고 있지? --> 고민 해결!
module.exports = {
  studyPoll, calculate,
};
