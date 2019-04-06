const {WebClient} = require('@slack/client');
const {botMessage} = require('./messagetemplate.js');
const {token} = require('./chatToken.js');
const {userInfo} = require('./userData.js');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({extended: true}));
const port = 3000;
const puppeteer = require('puppeteer');


const web = new WebClient(token);


const botHandler = (async () => {
  const res = await web.conversations.list({
    types: 'private_channel',
  });
  const channel = res.channels.find((c) => c.is_member); // 왜 이렇게 채널을 찾았었지?
  if (channel) {
    const attendList = [];
    const absentList = [];
    let remindList = [];
    const membersData = await web.conversations.members({
      channel: channel.id,
    });
    const memberList = membersData.members;
    app.post('/', (req, res) => {
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
      if (attendList.length + absentList.length >= 1) {
        const whoVoted = attendList.concat(absentList);
        remindList = memberList.filter((el)=>!whoVoted.includes(el));
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
    });
    app.listen(port, () => console.log('서버실행중!'));
    web.chat.postMessage({
      channel: `${channel.id}`,
      text: '',
      as_user: true,
      blocks: botMessage(attendList, absentList, remindList),
    });
    const todayDate = new Date();
    const dayToSec = 1000 * 60 * 60 * 24;
    const tempDate = new Date(todayDate.getTime() + (dayToSec * 3));
    const reserveYear = String(tempDate.getFullYear());
    const reserveMonth = (function() {
      const month = tempDate.getMonth() + 1;
      if (month < 10) {
        return ('0'.concat(String(month)));
      }
      return month;
    })();
    const reserveDay = (function() {
      const date = tempDate.getDate();
      if (date < 10) {
        return ('0'.concat(String(date)));
      }
      return date;
    })();
    const reserveDate = reserveYear + reserveMonth + reserveDay;
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.goto('https://spacecloud.kr/space/16034');
    // await page.click('li[_productid=\"27711\"]');
    // await page.click('.detail_contact_footer ._gotoReservation');
    // await page.click('.btn_login');
    // await page.focus('#id.int');
    // await page.keyboard.type(`${userInfo.userId}`, {delay: 100});
    // await page.focus('#pw.int');
    // await page.keyboard.type(`${userInfo.userPw}`, {delay: 100});
    // await page.click('.btn_global');
    // await page.click('.btn_cancel .btn');
    // await page.click('#name');
    // for (let i=0; i<3; i++) {
    //   await page.keyboard.press('Backspace');
    // }
    // await page.keyboard.type(`${userInfo.userName}`, {delay: 100});
    // await page.click(`td[_ymd=\"${reserveDate}\"]`);
    // await page.click('li[_tm=\"12\"]');
    // await page.mouse.move(0, 0);
    // await page.click('li[_tm=\"20\"] .price');
    // await page.click('li[_tm=\"21\"] .price');
    // await page.click('#_agreeEl .option');
    // await page.click('div.static > a.btn');
    // await page.click('div.btns > a._do_reserve');
  } else {
    console.log('그런 거 없다');
    console.log(res.channels);
  }
});

// const cron = require('node-cron');
// cron.schedule('56 21 * * wednesday', botHandler);
botHandler();
