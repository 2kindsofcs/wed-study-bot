module.exports = {
	botMessage: (attendList, absentList, remindList) => {
		let message = [
			{
				"type": "section",
				"fields": [
					{
						"type": "mrkdwn",
						"text": "*수요조사 나왔습니다*\n이번주 수요일 저녁 8시 모각코 참석하시는 분은 \"참석\"버튼 눌러주세요."
					}
				]
			},
			{
				"type": "actions",
				"elements": [
					{
						"type": "button",
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "참석"
						},
						"value": "attend"
					},
					{
						"type": "button",
						"text": {
							"type": "plain_text",
							"emoji": true,
							"text": "불참"
						},
						"value": "absent"
					}
				]
			},
			{
				"type": "section",
				"fields": [
					{
						"type": "mrkdwn",
						"text": `참석자: ${attendList.map((id) => `<@${id}>`).join(", ")} 불참: ${absentList.map((id) => `<@${id}>`).join(", ")}`
					}
				]
			}
		];
		if (remindList.length > 0) {
			message.push(
				{
					"type": "section",
					"fields": [
						{
							"type": "mrkdwn",
							"text": `투표안하신분 투표해주세요: ${remindList.map((id) => `<@${id}>`).join(", ")}`
						}
					]
				}
			)
		}
		return message
	}
};

