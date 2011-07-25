function msgJSON(request) {
  window.top.postMessage(JSON.stringify(request), "*")
}

function fitHeight() {
  msgJSON({action:'height', height:$('#bar').height()})
  $('#bar').width('100%')
}

function getRandomInt(min, max) {
  // via https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Math/random#Examples
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice(items) {
  return items[getRandomInt(0, items.length-1)]
}
