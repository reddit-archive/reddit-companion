$(document).ready(function() {
  $('input[type=checkbox]')
    .each(function(i, el) {
      if (localStorage[el.id] == 'true') { $(this).prop('checked', true) }
    })
    .click(function() {
      localStorage[this.id] = $(this).is(':checked')
      chrome.extension.sendRequest({action: 'optionChange', id: this.id})
    })
})
