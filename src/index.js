const { RTMClient, WebClient } = require('@slack/client');
const { botMessage } = require("./messagetemplate.js");
const { token } = require("./chatToken.js")
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({extended: true}));
const port = 3000;


// An access token (from your Slack app or custom integration - usually xoxb)


// The client is initialized and then started to get an active connection to the platform
// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
// See the "Combining with the WebClient" topic below for an example of how to get this ID
const conversationId = '#slave-test';
const web = new WebClient(token);



(async () => {
	const res = await web.conversations.list({
		types: "private_channel"
	});
	const channel = res.channels.find(c => c.is_member);

	if (channel) {
		let attendList = [];
		let absentList = [];
		let remindList = [];
		console.log("its channel-------------");
		const membersData = await web.conversations.members({
			channel: channel.id
		});
		const memberList = membersData.members;
		console.log(memberList);
		console.log("memend")
		app.post('/', (req, res) => {
			let data = JSON.parse(req.body.payload);
			// console.log(data)
			const userId = data.user.id;
			const isAttending = data.actions[0].value === "attend";
			if (isAttending & !attendList.includes(userId)) {
				attendList.push(userId);
				if (absentList.includes(userId)) {
					let index = absentList.findIndex((name) => name === userId);
					absentList.splice(index, 1);
				}
			} else if (!isAttending & !absentList.includes(userId)) {
				absentList.push(userId);
				if (attendList.includes(userId)) {
					let index = attendList.findIndex((name) => name === userId);
					attendList.splice(index, 1);
				}
			}
			if (attendList.length + absentList.length >= 1) {
				// let tempRemindList = memberList.filter((el)=>!attendList.includes(el));
				// remindList = tempRemindList.filter((el)=>!absentList.includes(el));
				let whoVoted = attendList.concat(absentList);
				remindList = memberList.filter((el)=>!whoVoted.includes(el))
			}
			const ts = data.container.message_ts;
			console.log(`<@${userId}> is ${isAttending ? 'attending' : 'absent'}`);
			web.chat.update(
				{
					ts: ts,
					channel: channel.id,
					text: "",
					as_user: true,
					blocks: botMessage(attendList, absentList, remindList)
				}
			);
			res.status(200);
			res.end();
		});
		app.listen(port, () => console.log("서버실행중!"))
		web.chat.postMessage({
			channel: `${channel.id}`,
			text: "",
			as_user: true,
			blocks: botMessage(attendList, absentList, remindList)
		});
	} else {
		console.log("그런 거 없다");
		console.log(res.channels)
	}
})();



// The RTM client can send simple string messages
// rtm.sendMessage('Hello there', conversationId)

