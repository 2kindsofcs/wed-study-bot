const {WebClient} = require('@slack/client');
const express = require('express');
const bodyParser = require('body-parser'); // 외부 라이브러리를 가급적 앞쪽에 써주자
const config = require('config');
const {dateToString} = require('./date_utils');
const {botMessage} = require('./message_template');
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './dev.sqlite3',
  },
});

const dateString = dateToString(new Date());

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

app.post('/', (req, res) => { // user가 참석 또는 불참 버튼을 클릭
  const reqTime = new Date().getTime();
  const memberList = membersData.members;
  const dueTime = new Date().getTime();
  if (reqTime - dueTime < (1000 * 60 * 60 * 6)) {
    const data = JSON.parse(req.body.payload);
    const userId = data.user.id;
    const [response, date] = data.actions[0].value.split('_');
    const isAttending = response === 'attend';
    const isValidDate = date === dateString;
    // 조건을 추가하고 싶을 때 계속 추가하다보면 if 밑에 또 if...식으로 너무 복잡해지므로
    // 이럴 때 쓰는 방법 중 하나가 역으로 if(!조건)하고 아무 일도 하지 않는 것.
    if (!isValidDate) {
      res.status(400);
      res.end();
      return;
    }
    if (isAttending && !attendList.includes(userId)) {
      attendList.push(userId);
      if (absentList.includes(userId)) {
        const index = absentList.findIndex((name) => name === userId);
        absentList.splice(index, 1);
      }
    } else if (!isAttending && !absentList.includes(userId)) {
      absentList.push(userId);
      if (attendList.includes(userId)) {
        const index = attendList.findIndex((name) => name === userId);
        attendList.splice(index, 1);
      }
    }
    sharedState.isMoreThanThree = attendList.length > 3;
    // 과반수를 넘었는지를 체크하고 싶은 건데, 꼭 정수와 정수를 비교해야하는 건 아니므로 ceil을 꼭
    // 쓸 필요는 없음.
    if (attendList.length + absentList.length >= memberList.length / 2) {
      const whoVoted = attendList.concat(absentList);
      remindList = memberList.filter((el) => !whoVoted.includes(el));
    }
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
