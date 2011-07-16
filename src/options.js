$(document).ready(function() {
	if(localStorage['showTooltips'] == "true") $('#showTooltips').attr("checked","checked");
	$('input[type=checkbox]').click(function() {
		localStorage[$(this).attr('id')] = $(this).is(':checked');
	});
});