/**
 * Stringify user id list with ', ' glue
 * @param {string[]} userIds
 * @return {string} stringified user id list
 */
function stringifyUserIdList(userIds) {
  return userIds.map((id) => `<@${id}>`).join(', ');
}

/**
 * @param {stringp[]} attended
 * @param {number} charge
 * @param {string} dateString
 * @return {*}
 */
function messageCal(attended, charge, dateString) {
  const message = [
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': `${dateString} 진행된 스터디 정산합니다.\n
        각자 ${charge}만큼 주시면 됩니다. ${stringifyUserIdList(attended)} `,
      },
    },
  ];
  return message;
}

module.exports = [
  messageCal,
];

