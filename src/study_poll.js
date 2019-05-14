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
    const attendList = await db('rsvp').where(
        {attending: true, stduy_date: dateString}
    ).select('member_name');
    const absentList = await db('rsvp').where(
        {attending: false, stduy_date: dateString}
    ).select('member_name');
    let remindList;
    noAnswerNum = await db('rsvp').where(
        {study_date: dateString}
    ).groupBy('attending').count('null');
    if (noAnswerNum < memberList.length / 2) {
      remindList = await db('rsvp').where(
          {attending: null, stduy_date: dateString}
      ).select('member_name');
    }

    // 옛날 코드
    // if (isAttending && !attendList.includes(userId)) {
    //   attendList.push(userId);
    //   if (absentList.includes(userId)) {
    //     const index = absentList.findIndex((name) => name === userId);
    //     absentList.splice(index, 1);
    //   }
    // } else if (!isAttending && !absentList.includes(userId)) {
    //   absentList.push(userId);
    //   if (attendList.includes(userId)) {
    //     const index = attendList.findIndex((name) => name === userId);
    //     attendList.splice(index, 1);
    //   }
    // }
    // sharedState.isMoreThanThree = attendList.length > 3;
    // // 과반수를 넘었는지를 체크하고 싶은 건데, 꼭 정수와 정수를 비교해야하는 건 아니므로 ceil을 꼭
    // // 쓸 필요는 없음.
    // if (attendList.length + absentList.length >= memberList.length / 2) {
    //   const whoVoted = attendList.concat(absentList);
    //   remindList = memberList.filter((el) => !whoVoted.includes(el));
    // }
    const ts = data.container.message_ts;
    console.log(`<@${userId}> is ${isAttending ? 'attending' : 'absent'}`);
    web.chat.update(
        {
          ts: ts,
          channel: channel.id,
          text: '',
          as_user: true,
          blocks: botMessage(attendList, absentList, remindList),
        }
    );
    res.status(200);
    res.end();
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
