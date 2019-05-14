const {WebClient} = require('@slack/client');
const express = require('express');
const bodyParser = require('body-parser'); // 외부 라이브러리를 가급적 앞쪽에 써주자
const config = require('config');
const {dateToString} = require('./date_utils');
const {botMessage} = require('./message_template');
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
    // post 요청이 날아온 시각을 확인하는 방법도 있겠지만, 어차피 크론이 6시에 예약을 시킬 것이므로
    // db를 확인해서(예약완료시 price에 가격이 기입될테니까) null이 아니면 요청 무시!
    if (await db('round_info').where({
      study_date: dateString, price: null,
    })) {
      const currentDate = dateToString(new Date());
    const userId = data.user.id;
    const isAttending = response === 'attend';
      const isValidDate = currentDate === dateString;
    // 조건을 추가하고 싶을 때 계속 추가하다보면 if 밑에 또 if...식으로 너무 복잡해지므로
    // 이럴 때 쓰는 방법 중 하나가 역으로 if(!조건)하고 아무 일도 하지 않는 것.
    if (!isValidDate) {
      res.status(400);
      res.end();
      return;
    }
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
    res.end();
  }
  } catch (e) {
    console.log(e);
  }
});

/**
 * @param {object} sharedState
 * @noreturns
 */
async function studyPoll(sharedState) {
  const dateString = dateToString(new Date());
  const web = new WebClient(config.get('chat_token'));
  const res = await web.conversations.list({
    types: 'private_channel',
  });
  // const res = await web.conversations.list();
  console.log(web.conversations);
  const channel = res.channels.find((c) => c.is_member); // 왜 이렇게 채널을 찾았었지?
  if (!channel) {
    console.log('그런 거 없다');
    console.log(res.channels);
    return;
  }
  if (await db('round_info').where({study_date: dateString}).count('*') !== 0) {
    return;
  }
  // 일단 가격은 모르니까(수요조사 전이므로) 스터디 날짜만 저장
  await db('round_info').insert({study_date: dateString});
  const membersList = (await web.conversations.members({
    channel: channel.id,
  })).members;
  // 스터디 날짜와 멤버들 이름만 저장
  await db('rsvp').insert(
      membersList.map((name)=>({study_date: dateString, member_name: name}))
  );
  web.chat.postMessage({
    channel: `${channel.id}`,
    text: '',
    as_user: true,
    blocks: botMessage([], [], [], dateString),
  });
} // 함수는 끝에 세미콜론 없어

module.exports = {
  studyPoll,
};
