/* Array for all the ACE editors */

var editors = [];
var sessionEnd = 0;
var timeOutId = 0;
var sessionTimeOut = 0;
var markers = [];
var markersEditor = [];
var lastResize = 0;
var maxWidth = 0;

/* Execute if DOM is ready */
$(function () {
	var currentStruc, maxStruc, strucPre, actTab, keySwitch,  preventTabSwitch,  showChangeLog, accordionAttr, pre, data;
	currentStruc = $('.num').length;
	maxStruc = $('#maxStruc').val();
	strucPre = $('#strucPre').val();
	actTab = parseInt($('#actTab').val(), 10);
	keySwitch = false;
	preventTabSwitch = false;
	showChangeLog = $('#showChangeLog').val();
	maxWidth = $('.struccontainer').width() - 40;
	accordionAttr = {
		collapsible: false,
		heightStyle: "content",
		event: "mouseup",
		beforeActivate: function (event, ui) {
			if (preventTabSwitch) {
				preventTabSwitch = false;
				event.preventDefault();
			}
		},
		activate: function (event, ui) {
			actTab = $('.struccontainer').index(ui.newPanel);
			$('#actTab').val(actTab);
			if (!keySwitch) {
				var s = ui.newPanel.find(".impl").attr("id");
				editors[s].focus();
			}
			keySwitch = false;
		}
	};

	if (currentStruc >= maxStruc) {$("#addStruc").attr("disabled", "disabled"); }
	sessionTimeOut =  parseInt($('#timeOut').val(), 10);
	sessionEnd = new Date().getTime() + sessionTimeOut;
	timeOutId = setInterval(checkIfTimeOut, (sessionTimeOut / 20));
	
	/* Print warning if cookies are disabled */
	if (navigator.cookieEnabled != true) {
		$('#warning').show();
	}

	if ($('.delStruc').size() <= 1) {
		$('.delStruc').hide();
	}

	initResize();

	/* initialize Accordion */
	$("#accordion").accordion(accordionAttr).accordion("option", "active", actTab);

	/* initialize ACE enviroments */
	$(".struccontainer").each(function (index) {
		var impl, sign;
		impl = $(this).find(".impl").attr("id");
		sign = $(this).find(".sign").attr("id");
		editors[impl] = ace.edit(impl);
		editors[impl].setTheme("ace/theme/chrome");
		editors[impl].getSession().setMode("ace/mode/opal");
		editors[impl].getSession().setValue($(this).find(".impl_hidden").val());
		editors[sign] = ace.edit(sign);
		editors[sign].setTheme("ace/theme/chrome");
		editors[sign].getSession().setMode("ace/mode/opal");
		editors[sign].getSession().setValue($(this).find(".sign_hidden").val());
	});

	$("#restore_exampl").click(function () {
		var num = $('.num:first').val();
		editors["editor-impl-" + num].setValue($('#implEx').val());
		editors["editor-sign-" + num].setValue($('#signEx').val());
		$('#runFunction').val($('#cmdEx').val());
	});

	$(document).on("change", '.nameInput', function (event) {
		var num, name;
		num = $(this).parent().find('.num').val();
		name = $(this).val();
		checkSignAndImpl(num, name);
	});

	$(document).on("click", '.errorJump', function (event) {
		var c, err, editor;
		event.preventDefault();
		try {
			err = $.parseJSON($(this).attr("value"));
		} catch (e) {
			return false;
		}
		c = $('#accordion h3').index($(".nameInput[value=" + err.file + "]").parent());
		editor = "editor-" + err.type + "-" + $(".nameInput[value=" + err.file + "]").parent().find('.num').val();
		keySwitch = true;
		$('#accordion').accordion("option", "active", c);
		//alert(err.file);
		editors[editor].focus();
		editors[editor].gotoLine(parseInt(err.toLine, 10) + 1, parseInt(err.toChar, 10) + 1, false);
	});

	$(document).on("mouseenter", '.delStruc', function (event) {
		preventTabSwitch = true;
	});

	$(document).on("mouseleave", '.delStruc', function (event) {
		preventTabSwitch = false;
	});

	$(document).on("click", '.delStruc', function (event) {
		if ($('.delStruc').size() > 1) {
			var answer, name, num, index, impl, sign;
			name = $(this).parent().find('.nameInput').val();
			answer = confirm(name + " wirklich löschen?");
			if (answer) {
				num = $(this).parent().find('.num').val();
				index = $('.filename').index($(this).parent());
				if (index == actTab) {
					keySwitch = true;
					preventTabSwitch = false;
					if (actTab == 0) {actTab = 1; } else {actTab = actTab - 1; }
					$("#accordion").accordion("option", "active", actTab);
				}
				$(this).parent().hide('slow', function () {
					$(this).next(".struccontainer").remove();
					$(this).remove();
					if ($('.delStruc').size() <= 1) {$('.delStruc').hide(); }
				});
				currentStruc -= 1;
				$('#structnr').val(currentStruc);
				impl = "editor-impl-" + num;
				sign = "editor-sign-" + num;
				delete (editors[impl]);
				delete (editors[sign]);
				if (currentStruc < maxStruc) {$("#addStruc").removeAttr("disabled"); }
				$.ajax({
					url: 'inc/ajax.php',
					type: 'GET',
					dataType: "json",
					data: "page=update&structnr=" + currentStruc + "&delete=" + num,
					success: function () {sessionEnd = new Date().getTime() + sessionTimeOut; },
					error: function (data) {
						$('#dialog').html("HTTP-Status: " + data.status + " (" + data.statusText + ")\n" + data.responseText);
						$('#dialog').dialog({title: "ERROR", width: 700});
					}
				});
			}
		}
	});

	$('#addStruc').click(function () {
		if (currentStruc < maxStruc) {
			var strucNum, name, impl, sign;
			currentStruc += 1;
			strucNum = parseInt($('.num:last').val(), 10) + 1;
			name = strucPre + "datei" + strucNum;
			$('#accordion').append(
				'<h3 class="filename">' +
					'	<span style="float:right" class="delStruc" v>Löschen</span>' +
					'	Struktur <input id="name' + strucNum + '" class="nameInput" name="fileName[' + strucNum + ']" value="' + name + '">' +
					'	<input type="hidden" value="' + strucNum + '" class="num">' +
					'</h3>' +
					'<div class="struccontainer" style="padding:10px;">' +
					'	<div class="implcontainer resizeEditor">' +
					'		<div class="resizeNot">Implementation: <input type="file" name="impl-' + strucNum + '"><input type="hidden" name="MAX_FILE_SIZE" value="100000"><input type="submit" value="Upload"></div>' +
					'		<div class="impl resizeAlso" id="editor-impl-' + strucNum + '"></div>' +
					'		<input type="hidden" class="impl_hidden" value="" name="implInput[' + strucNum + ']">' +
					'	</div>' +
					'	<div class="signcontainer resizeEditor">' +
					'		<div class="resizeNot">Signatur: <input type="hidden" name="MAX_FILE_SIZE" value="100000"><input type="file" name="sign-' + strucNum + '"><input type="submit" value="Upload"></div>' +
					'		<div class="sign resizeAlso" id="editor-sign-' + strucNum + '"></div>' +
					'		<input type="hidden" class="sign_hidden" value="" name="signInput[' + strucNum + ']">' +
					'	</div>' +
					'</div>'
			).accordion('destroy').accordion(accordionAttr).accordion("option", "active", actTab);
			impl = "editor-impl-" + strucNum;
			sign = "editor-sign-" + strucNum;
			editors[impl] = ace.edit(impl);
			editors[impl].setTheme("ace/theme/chrome");
			editors[impl].getSession().setMode("ace/mode/opal");
			editors[sign] = ace.edit(sign);
			editors[sign].setTheme("ace/theme/chrome");
			editors[sign].getSession().setMode("ace/mode/opal");
			$('#structnr').val(currentStruc);

			if ($('.delStruc').size() > 1) {$('.delStruc').show(); }
			$.ajax({
				url: 'inc/ajax.php',
				type: 'GET',
				dataType: "json",
				data: "page=update&file=" + strucNum + "&structnr=" + currentStruc,
				success: function () {	sessionEnd = new Date().getTime() + sessionTimeOut; initResize(); },
				error: function (data) {
					$('#dialog').html("HTTP-Status: " + data.status + " (" + data.statusText + ")\n" + data.responseText);
					$('#dialog').dialog({title: "ERROR", width: 700});
				}
			});
		}
		if (currentStruc >= maxStruc) {
			$("#addStruc").attr("disabled", "disabled");
		}
	});

	/* Bind click action to execute button */
	$("#execute").click(function () {
		/* copy content of ACE to hidden inputs */
		$(".struccontainer").each(function (index) {
			$(this).find(".impl_hidden").val(editors[$(this).find(".impl").attr("id")].getSession().getValue());
			$(this).find(".sign_hidden").val(editors[$(this).find(".sign").attr("id")].getSession().getValue());
		});
		/* Deactivate Button */
		$("#execute").attr("disabled", "disabled");
		$("#execute").attr("value", "Lade...");
		/* GET Request */
		$.ajax({
			url: 'inc/ajax.php',
			type: 'GET',
			dataType: "json",
			data: $('#mainsubmit').serialize() + "&oasys=true&page=update",
			/* Populate output and activate button on success */
			success: function (data) {
				var date, hh, mm, ss, errors, i, editor, marker, e, err, Range, r, m;
				date = new Date();
				hh = date.getHours();
				if (hh < 10) {hh = "0" + hh; }
				mm = date.getMinutes();
				if (mm < 10) {mm = "0" + mm; }
				ss = date.getSeconds();
				if (ss < 10) {ss = "0" + ss; }
				$('#output').html("Letzte Ausf&uuml;hrung: " + hh + ":" + mm + ":" + ss + "<br>" + data.log);
				$("#execute").attr("value", "Programm ausführen");
				$("#execute").removeAttr("disabled");
				sessionEnd = new Date().getTime() + sessionTimeOut;
				errors = $.parseJSON(data.err);
				for (i = 0; i < markers.length; i += 1) {
					editor = markersEditor[i];
					marker = markers[i];
					editors[editor].getSession().removeMarker(marker);
				}
				markers = [];
				markersEditor = [];
				for (e in errors) {
					if (errors.hasOwnProperty(e)) {
						err = errors[e];
						editor = "editor-" + err.type + "-" + $(".nameInput[value=" + err.file + "]").parent().find('.num').val();
						Range = require('ace/range').Range;
						r = new Range(parseInt(err.fromLine, 10), parseInt(err.fromChar, 10), parseInt(err.toLine, 10), parseInt(err.toChar, 10));
						m = editors[editor].getSession().addMarker(r, "warning", "text", true);
						markers.push(m);
						markersEditor.push(editor);
					}
				}
			},
			error: function (data) {
				$('#dialog').html("HTTP-Status: " + data.status + " (" + data.statusText + ")\n" + data.responseText);
				$('#dialog').dialog({title: "ERROR", width: 700});
				$("#execute").attr("value", "Programm ausf\u00FChren");
				$("#execute").removeAttr("disabled");
			}
		});
	});

	/* Bind click functions for download, changelog, etc  */
	$(".dialog").click(function () {
		var name, w;
		name = $(this).attr("name");
		w = 700;
		if (name == "download") {
			/* Execute OPAL Code */
			$('#execute').click();
			w = 300;
		}
		$.ajax({
			url: 'inc/ajax.php',
			type: 'GET',
			dataType: "json",
			data: "page=" + name,
			success: function (data) {
				$('#dialog').html(data.text);
				$('#dialog').dialog({title: data.title, width: w});
				sessionEnd = new Date().getTime() + sessionTimeOut;
			},
			error: function (data) {
				$('#dialog').html("HTTP-Status: " + data.status + " (" + data.statusText + ")\n" + data.responseText);
				$('#dialog').dialog({title: "ERROR", width: 700});
			}
		});
	});

	$('#runFunction').keypress(function (e) {
		if (e.which == 13) {
			e.preventDefault();
			$("#execute").click();
		}
	});

	/* Bind action for ctrl+space code completion */
	$(document).keydown(function (e) {
		var i, s, editor, wordAtLeft, possibleWord, possibleWords, foundWords, editorPos;
		if ((e.ctrlKey || e.metaKey) && (e.charCode || e.keyCode) == 13) {
			$('#execute').click();
		} else if ((e.ctrlKey || e.metaKey) && String.fromCharCode(e.charCode || e.keyCode) === " ") {
			//Find focused ACE editor
			s = $('.ace_focus').attr("id");
			if (editors[s] == null) {
				return false;
			}

			//Get word left from cursor
			editors[s].selection.selectWordLeft();
			wordAtLeft = editors[s].session.getDocument().getTextRange(editors[s].selection.getRange());
			editors[s].selection.selectWordRight();

			// If wordAtLeft too small, dont try to complete
			if (wordAtLeft.length < 2) { return false; }

			//List of words which should be always available for code completion
			possibleWords = ["IMPORT", "denotation", "Denotation", "COMPLETELY", "ONLY", "NatConv", "RealConv", "CharConv", "WHERE", "newline", "SIGNATURE", "IMPLEMENTATION"];

			/* Extend the possibleWords List with words longer than 4 letters in ace editors
			 * If you have for example the word "sortYear" in one of the editors
			 * and type "sort"+ctrl+space in another editor, it should autocomplete
			 */
			$(".ace_editor").each(function (index) {
				var i, id, inEditor;
				id = $(this).attr("id");
				inEditor = editors[id].getValue().match(/((?=\.)?\$?_?[A-Za-z_]{4,})/g);
				if (inEditor != null) {
					for (i = 0; i < inEditor.length; i += 1) {
						if (possibleWords.indexOf(inEditor[i]) == -1) {possibleWords.push(inEditor[i]); }
					}
				}
			});

			foundWords = [];

			/* Check if our wordLeft has ONE possible match in possibleWords */
			for (i = 0; i < possibleWords.length; i += 1) {
				possibleWord = possibleWords[i];
				if (possibleWord !== undefined &&
						possibleWord !== wordAtLeft &&
						possibleWord.substring(0, wordAtLeft.length) === wordAtLeft &&
						possibleWord !== 'length') {

					// stop, if there is more than one possibility
					if (foundWords.length === 1) { return false; }
					if (possibleWord !== 'length') { foundWords[0] = possibleWord; }
				}
			}

			// stop, if no word found
			if (foundWords.length === 0) {return false; }

			// insert found word
			editors[s].removeWordLeft();
			editors[s].insert(foundWords[0]);

		} else if (
			((e.altKey || e.metaKey) && (e.ctrlKey) &&
				(-1 != $.inArray(e.keyCode, [98, 100, 102, 104]))
			)
		) {
			e.preventDefault();
			editorPos = [];
			for (editor in editors) {
				if (editors.hasOwnProperty(editor)) {
					editorPos.push(editor);
				}
			}

			i = $.inArray($('.ace_focus').attr("id"), editorPos);

			if (i != -1) {
				switch (e.keyCode) {
				case 104: //UP with NUM-8
					if (i - 2 < 0) {i = editorPos.length - 2 + i % 2; } else { i -= 2; }
					break;
				case 100: //LEFT with NUM-4
					if (i - 1 < 0) {i = editorPos.length - 1; } else {i -= 1; }
					break;
				case 98: //DOWN with NUM-2
					if (i + 2 > editorPos.length - 1) { i = i % 2; } else { i += 2; }
					break;
				case 102: //RIGHT with NUM-6
					if (i + 1 > editorPos.length - 1) { i = 0; } else { i += 1; }
					break;
				}

				keySwitch = true;

				$('#accordion').accordion("option", "active", (i - (i % 2)) / 2);
				editors[editorPos[i]].focus();
			}
		}
	});

    $('#bugReport').click(function () {
		$('#dialog').html("<div id='issueList'><h3 class='title'>Issueliste</h3><div class='content'></div></div><div id='reportForm'><h3 class='title'>Reportformular</h3><div class='content'></div></div>");
		$('#dialog').dialog().dialog("destroy");
		$('#dialog').dialog({
			title: "Bugreport / Idee einreichen",
			width: "80%",
			height: $(window).height() * 0.8,
			modal: true,
			open: function () {
				$('.ui-dialog').css("position", "fixed");
				clearInterval(timeOutId);
			},
			close: function () {
				$('.ui-dialog').css("position", "absolute");
				if (!checkIfTimeOut()) {
					timeOutId = setInterval(checkIfTimeOut, (sessionTimeOut / 20));
				}
			}
		});
		getIssueForm();
		getIssueList();
    });

	if (showChangeLog != "") {
		if (showChangeLog == "firstTime") {
			data = "page=features";
			pre = "<h3>Herzlich Willkommen bei WebOpal!</h3>Hier hast du eine kleine Übersicht der Features:";
		} else if (showChangeLog.substring(0, 11) == "updateSince") {
			data = "page=changelog&since=" + showChangeLog.substring(11);
			pre = "<h3>Seit dem du das letzte mal da warst, hat sich einiges geändert!</h3>";
		}
		if (data != null) {
			$.ajax({
				url: 'inc/ajax.php',
				type: 'GET',
				dataType: "json",
				data: data,
				success: function (data) {
					$('#dialog').html(pre + data.text);
					$('#dialog').dialog({title: "Herzlich Willkommen", width: 700});
					sessionEnd = new Date().getTime() + sessionTimeOut;
				},
				error: function (data) {
					$('#dialog').html("HTTP-Status: " + data.status + " (" + data.statusText + ")\n" + data.responseText);
					$('#dialog').dialog({title: "ERROR", width: 700});
				}
			});
		}
	}

});
