$(document).ready(function() {
  var messages = [
    'greetings, human.',
    'someone is wrong on the internet!',
    'regarding your karma portfolio',
    '[meme regarding narwhals]',
    'help, trapped in an options page'
  ]
  $('.notification-demo > .message').text(randomChoice(messages))

  $('input[type=checkbox]')
    .each(function(i, el) {
      if (localStorage[el.id] == 'true') {
        $(this).prop('checked', true)
        $('#contents').addClass(el.id)
      }
    })
    .click(function() {
      var value= $(this).is(':checked')
      localStorage[this.id] = value
      $('#contents').toggleClass(this.id, value)
    })
	$('#notifyTime')
	.val(localStorage['notifyTime'])
	.change(function() {
		var sec = parseInt($(this).val())
		if (isNaN(sec)) sec = 30
		else if(sec > 300) sec = 300
		else if (sec < 10) sec = 10
		localStorage[$(this).attr('id')] = sec
		$('#numSeconds').text(sec);
	})
	$('#numSeconds').text(localStorage['notifyTime']);
  $('#checkMail')
    .click(function() {
      var checked = this.checked;
      $('.requires-mail').each(
        function(idx, elt) {
          elt.disabled = !checked;
        }
      );
    });
  $('#notifyTimeout')
    .click(function() {
      var checked = this.checked;
      $('.requires-timeout').each(
        function(idx, elt) {
          elt.disabled = !checked;
        }
      );
    });
})
