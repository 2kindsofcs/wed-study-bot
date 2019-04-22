const {WebClient} = require('@slack/client');
const express = require('express');
const bodyParser = require('body-parser'); // 외부 라이브러리를 가급적 앞쪽에 써주자
const {botMessage} = require('./message_template');
const {token} = require('./chatToken'); // 확장자 안 붙이는 게 맞음


const port = 3000;

const app = express();
app.use(bodyParser.urlencoded({extended: true}));

const web = new WebClient(token);

/**
 * @param {object} sharedState
 * @noreturns
 */
async function studyPoll(sharedState) {
  const res = await web.conversations.list({
    types: 'private_channel',
  });
  // const res = await web.conversations.list();
  console.log(web.conversations);
  const channel = res.channels.find((c) => c.is_member); // 왜 이렇게 채널을 찾았었지?
  if (channel) {
    const attendList = [];
    const absentList = [];
    let remindList = [];
    const membersData = await web.conversations.members({
      channel: channel.id,
    });
    const memberList = membersData.members;
    const dueTime = new Date().getTime();
    app.post('/', (req, res) => { // user가 참석 또는 불참 버튼을 클릭
      const reqTime = new Date().getTime();
      if (reqTime - dueTime < (1000 * 60 * 60 * 6)) {
        const data = JSON.parse(req.body.payload);
        const userId = data.user.id;
        const isAttending = data.actions[0].value === 'attend';
        if (isAttending & !attendList.includes(userId)) {
          attendList.push(userId);
          if (absentList.includes(userId)) {
            const index = absentList.findIndex((name) => name === userId);
            absentList.splice(index, 1);
          }
        } else if (!isAttending & !absentList.includes(userId)) {
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
    app.listen(port, () => console.log('서버실행중!'));
    web.chat.postMessage({
      channel: `${channel.id}`,
      text: '',
      as_user: true,
      blocks: botMessage(attendList, absentList, remindList),
    });
  } else {
    console.log('그런 거 없다');
    console.log(res.channels);
  }
} // 함수는 끝에 세미콜론 없어
module.exports = {
  studyPoll,
};
