<?php
session_start();
ob_start(); //start output buffering
include 'config.php';
include 'contributors.php';
include 'gc.php';

//Sessionexpiration
if(isset($_SESSION['sessionstart'])){
	$sessionlife = time() - $_SESSION['sessionstart'];
	if($sessionlife > $SESSIONTIMEOUT){
		session_unset();
		session_destroy();
	}
} else {
	$_SESSION['sessionstart'] = time();
}

/* Check if $_SESSION is set, if not initialize them */
if(!isset($_SESSION['runFunction'])) {$_SESSION['runFunction']=""; }
if(!isset($_SESSION['focus'])) {$_SESSION['focus']=0; }
if(!isset($_SESSION['randNum'])) {$_SESSION['randNum']=md5(time().str_shuffle(time()));}
if(!isset($_SESSION['structnr'])) {$_SESSION['structnr']=$MINFILES;}

/* Check if $_POST['structnr'] is set, if yes, update $_SESSION */
if(isset($_POST['structnr'])) {
	try{
		if(intval($_POST['structnr'])>$MAXFILES){	
			$_SESSION['structnr']=$MAXFILES;
		} else if(intval($_POST['structnr'])<=0){
			$_SESSION['structnr']=$MINFILES;
		} else {
			$_SESSION['structnr']=intval($_POST['structnr']);
		}
	} catch (Exception $e) {
		echo('<script>alert("Error: '. $e->getMessage() .'");</script>');
	}
}

/* initialize structure names, etc. */
for($i=0;$i<$_SESSION['structnr'];$i++){
	/* If the structure has no name, create one */
	if(!isset($_SESSION['fileName'][$i])) {
		$_SESSION['fileName'][$i]=substr($_SESSION['randNum'],0,4)."datei".$i;
	}else{
		if($_SESSION['fileName'][$i]==""){
			$_SESSION['fileName'][$i]=substr($_SESSION['randNum'],0,4)."datei".$i;
		}
	}
	/* initialize further $_SESSION if necessary */
	if(!isset($_SESSION['implInput'][$i])) {$_SESSION['implInput'][$i]=""; }
	if(!isset($_SESSION['signInput'][$i])) {$_SESSION['signInput'][$i]=""; }
}

//First Visit? --> set cookie
if(!isset($_COOKIE['visited'])){
	setcookie("visited", 1, time() + (86400 * 365)); //86400sec is one day
	$_SESSION['signInput'][0] = $EXAMPLECODE_SIGN;
	$_SESSION['implInput'][0] = $EXAMPLECODE_IMPL;
	$_SESSION['runFunction'] = "hello";
}

?>

<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<head>
	<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
	<title>WebOpal v0.2</title>
	<link rel="stylesheet" type="text/css" href="http://code.jquery.com/ui/1.9.1/themes/base/jquery-ui.css">
	<link rel="stylesheet" type="text/css" href="style.css">
	<script type="text/javascript" src="http://code.jquery.com/jquery-1.8.2.min.js"></script>
	<script type="text/javascript" src="http://code.jquery.com/ui/1.9.1/jquery-ui.min.js"></script>
	<script src="ace/ace.js" type="text/javascript" charset="utf-8"></script>
	<script language="javascript" type="text/javascript">
	/* Array for all the ACE editors */
	var editors = new Array();
	
	/* Execute if DOM is ready */
   $(function() {
   	
   	/* initialize Accordion */
		$("#accordion").accordion({
			collapsible:false,
			heightStyle: "content",
			event: "mouseup",
			active : <?php echo $_SESSION['focus'];?>,
			activate: function(event, ui){
				s = ui.newPanel.find(".impl").attr("id");
				editors[s].focus();
			}
		});
		
		/* initialize ACE enviroments */
		$(".struccontainer").each(function(index){
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

		/* Bind click action to execute button */
		$("#execute").click(function(){
			
			/* copy content of ACE to hidden inputs */
			$(".struccontainer").each(function(index){
				$(this).find(".impl_hidden").val(editors[$(this).find(".impl").attr("id")].getSession().getValue())
				$(this).find(".sign_hidden").val(editors[$(this).find(".sign").attr("id")].getSession().getValue())
			});
			
			/* Deactivate Button */
			$("#execute").attr("disabled","disabled")
			$("#execute").attr("value","Lade...")
			
			/* GET Request */
			$.get(
				'oasys.php', 
				$('#mainsubmit').serialize(),
				/* Populate output and activate button on success */
				function(data) {
					$('#output').text(data)
					$("#execute").attr("value","Programm ausführen")
					$("#execute").removeAttr("disabled")
				},
				'json'
			);
		});

		/* Bind click functions for download, changelog, etc  */
		$(".dialog").click(function(){
			name=$(this).attr("name");
			w=700;
			if(name=="download"){
				/* Execute OPAL Code */
				$('#execute').click();
				w='auto';
			}
			$.get(
				'dialog.php',
				"page="+name,
				function(data) {
					$('#dialog').html(data.text);
					$('#dialog').html(data.text);
					$('#dialog').dialog({title: data.title, width: w});
				},
				'json'
			);
		});

		/* Bind action for ctrl+space code completion */
		$(document).keydown(function(e){
			if( (e.ctrlKey||e.metaKey) && String.fromCharCode(e.charCode || e.keyCode) === " "){
				
				//Find focused ACE editor
				s=$('.ace_focus').attr("id");
				try { editors[s]; }
				catch (e) {return false;}

				//Get word left from cursor
				editors[s].selection.selectWordLeft();
				var wordAtLeft = editors[s].session.getDocument().getTextRange(editors[s].selection.getRange())
				editors[s].selection.selectWordRight();

				// If wordAtLeft too small, dont try to complete
				if ( wordAtLeft.length < 2 ){ return false; }

				//List of words which should be always available for code completion
				var possibleWords = new Array("IMPORT","denotation","Denotation","COMPLETELY","ONLY","NatConv","RealConv","CharConv","WHERE", "newline");

				/* Extend the possibleWords List with words longer than 4 letters in ace editors
				 * If you have for example the word "sortYear" in one of the editors
				 * and type "sort"+ctrl+space in another editor, it should autocomplete
				 */
				$(".ace_editor").each(function(index){
					id=$(this).attr("id");
					var inEditor = editors[id].getValue().match(/((?=\.)?\$?_?[A-Za-z_]{4,})/g);
					if(inEditor!=null){
						for(i=0;i<inEditor.length;i++){
							if(possibleWords.indexOf(inEditor[i])==-1){possibleWords.push(inEditor[i]);}
						}
					}
				});

				var foundWords = new Array();

				/* Check if our wordLeft has ONE possible match in possibleWords */
				for(i=0;i<possibleWords.length;i++){
					var possibleWord = possibleWords[i];
					if (	possibleWord !== undefined &&
							possibleWord !== wordAtLeft &&
							possibleWord.substring(0, wordAtLeft.length) === wordAtLeft &&
							possibleWord !== 'length') {
								// stop, if there is more than one possibility
								if ( foundWords.length === 1 ){ return false; }
								if ( possibleWord !== 'length'  ){ foundWords[ 0 ] = possibleWord; }
					}
				}
				
				// stop, if no word found
				if ( foundWords.length === 0 ) return false;

				// insert found word
				editors[s].removeWordLeft();
				editors[s].insert( foundWords[ 0 ] );

				return false;
			}
		});
		
		/* Print warning if cookies are disabled */
		if (navigator.cookieEnabled != true) {
		  $('#warning').show()
		}
	});

	</script>
	<script language="javascript" type="text/javascript">
	  (function() {
	    var cx = '014104389563113645663:vm6azr2-wkg';
	    var gcse = document.createElement('script'); gcse.type = 'text/javascript'; gcse.async = true;
	    gcse.src = (document.location.protocol == 'https:' ? 'https:' : 'http:') +
		'//www.google.de/cse/cse.js?cx=' + cx;
	    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(gcse, s);
	  })();
	</script>
</head>
<body>
	<div id="wrapper">
		<div id="heading">
			<h1 style="display:inline;">WebOpal v0.2  </h1>   
			<a href="#" name="features" class="dialog">[Features]</a> &middot; <a href="#" name="changelog" class="dialog">[Changelog]</a>
		</div>
		<hr style="margin:0px -10px;"><br>
		<noscript><span class='error'>Bitte aktiviere Javascript, damit WebOpal ordentlich funktioniert. Wir brauchen das f&uuml;r das Akkordion, sowie f&uuml;r die Ajax-Requests zur Auswertung des Opalcodes.</span><br></noscript>
		<span>Bitte in der Impl bzw. Sign die IMPLEMENTATION bzw. SIGNATURE weglassen. </span>
		<div id="warning" style="display:none;"><br><br><h1 style="display:inline;">Bitte aktiviere Cookies!</h1><span>(was sind <a href="http://de.wikipedia.org/wiki/HTTP-Cookie" target="_blank">Cookies</a>?)</span></div><br><br>
		<form action="index.php" method="POST"><input type="text" name="structnr" value="<?php echo($_SESSION['structnr']); ?>"><input type="submit" value="Anzahl der Strukturen &auml;ndern">  (Maximal <?php echo($MAXFILES); ?> Strukturen m&ouml;glich)</form>
		<form action="index.php" method="post" id="mainsubmit">
				<div id="accordion">
				<?php
				/* Print Signature & Implementation Areas */
				for($i=0;$i<$_SESSION['structnr'];$i++){
					if($i==$_SESSION['focus']){$checked="checked";}else{$checked="";}
					echo '
					<h3 class="filename">
					Struktur '.($i+1).'; Name: <input id="name'.$i.'" class="name_eingabe" name="name['.$i.']" value="'.htmlentities($_SESSION['fileName'][$i]).'">
					<input type="radio" name="focus" value="'.$i.'" '.$checked.'> Fokus
					</h3>
					<div class="struccontainer" style="padding:10px;">
						<div class="implcontainer">
							Implementation:
							<div class="impl" id="editor-impl-'.$i.'"></div>
							<input type="hidden" class="impl_hidden" value="'.htmlentities($_SESSION['implInput'][$i]).'" name="implInput['.$i.']" >
						</div>
						<div class="signcontainer">
							Signatur:
							<div class="sign" id="editor-sign-'.$i.'"></div>
							<input type="hidden" class="sign_hidden" value="'.htmlentities($_SESSION['signInput'][$i]).'" name="signInput['.$i.']" >
						</div>
					</div>';
				}
				?>
				</div>
				<br>
				<div id="funccontainer">
					Funktionsaufrufe (auch mehrere z.B. "hello;f(x,y)")<br>
					<input name="runFunction" type="text" size="43" value="<?php echo htmlentities($_SESSION['runFunction']);?>">
				</div>
				<div id="sendcontainer">
					<br>
					<input type="button" name="execute" id="execute" value="Programm ausf&uuml;hren" >
				</div>
			</form>
				<div id="outputcontainer">
					<textarea id="output" name="output" cols="110" rows="10">Ausgabe</textarea>
				</div>
		<div id="download">
			<input type="button" name="download" class="dialog" value="Download als Tarball">
		</div>
		<br>
		Bibliotheca Opalica Suche:
    	<div id="customsearch">
			<div class="gcse-search"></div>
      </div>		
		<div id="github">
			<a href="https://github.com/gehaxelt/PHP-Webopal" id='githublink'>Fork us on GitHub:</a>
			<iframe src="http://ghbtns.com/github-btn.html?user=gehaxelt&amp;repo=PHP-Webopal&amp;type=fork&amp;count=true" frameborder="0" scrolling="NO" width="95" height="20"></iframe>
		</div>
		<div id="contributors">
			WebOpal (c) 2012 by <?php echo echo_contributors(); ?>, <a href="<?php echo htmlentities($IMPRESSUM); ?>">Impressum</a>
		</div>
	</div>
<div id="dialog"></div>
	<?php include "piwik.php"; ?>
</body>

</html>

<?php
	$output = ob_get_clean();
	ignore_user_abort(true);
	set_time_limit(0);
	header("Connection: close");
	header("Content-Length: ".strlen($output));
	header("Content-Encoding: none");
	echo $output.str_repeat(' ', 1) ."\n\n\n";
	flush(); //script send all data to the browser
	run_gc(false);
?>
