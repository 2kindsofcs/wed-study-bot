addZero = function(num) {
  if (num < 10) {
    return ('0'.concat(String(num)));
  }
  return num;
};

module.exports = {
  dateToString: function(dayAfter = 0, isFull = false) {
    const todayDate = new Date();
    const dayToSec = 1000 * 60 * 60 * 24;
    const tempDate = new Date(todayDate.getTime() + (dayToSec * dayAfter));
    const year = String(tempDate.getFullYear());
    const month = (function() {
      const month = tempDate.getMonth() + 1;
      return addZero(month);
    })();
    const day = (function() {
      const date = tempDate.getDate();
      return addZero(date);
    })();
    let dateString = year + month + day;
    if (isFull) {
      const hour = (function() {
        const hour = tempDate.getHours();
        return addZero(hour);
      })();
      dateString = dateString + hour;
    };
    return dateString;
  },
};
