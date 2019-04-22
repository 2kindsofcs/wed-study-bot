/**
 * Stringify user id list with ', ' glue
 * @param {string[]} userIds
 * @return {string} stringified user id list
 */
function stringifyUserIdList(userIds) {
  return userIds.map((id) => `<@${id}>`).join(', ');
}

/**
 *
 * @param {string[]} attendList
 * @param {string[]} absentList
 * @param {string[]} remindList
 * @return {*}
 */
function botMessage(attendList, absentList, remindList) {
  const message = [
    {
      'type': 'section',
      'fields': [
        {
          'type': 'mrkdwn',
          'text': `*수요조사 나왔습니다*
이번주 수요일 저녁 8시 모각코 참석하시는 분은 "참석"버튼 눌러주세요.`,
        },
      ],
    },
    {
      'type': 'actions',
      'elements': [
        {
          'type': 'button',
          'text': {
            'type': 'plain_text',
            'emoji': true,
            'text': '참석',
          },
          'value': 'attend',
        },
        {
          'type': 'button',
          'text': {
            'type': 'plain_text',
            'emoji': true,
            'text': '불참',
          },
          'value': 'absent',
        },
      ],
    },
    {
      'type': 'section',
      'fields': [
        {
          'type': 'mrkdwn',
          'text': `참석자: ${
            stringifyUserIdList(attendList)
          } 불참: ${
            stringifyUserIdList(absentList)
          }`,
        },
      ],
    },
  ];
  if (remindList.length > 0) {
    message.push(
        {
          'type': 'section',
          'fields': [
            {
              'type': 'mrkdwn',
              'text': `투표안하신분 투표해주세요: ${
                stringifyUserIdList(remindList)
              }`,
            },
          ],
        }
    );
  }
  return message;
}
module.exports = {
  botMessage,
};

