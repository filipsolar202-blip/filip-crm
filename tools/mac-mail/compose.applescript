use framework "Foundation"
use scripting additions

on «event GURLGURL» incomingURL
 try
  set parts to current application's NSURLComponents's componentsWithString:incomingURL
  if (parts's |scheme|() as text) is not "filipcrm-mail" or (parts's |host|() as text) is not "compose" then error "Neplatný odkaz CRM."
  set payload to missing value
  repeat with itemRef in parts's queryItems()
   if (itemRef's |name|() as text) is "payload" then set payload to itemRef's |value|()
  end repeat
  if payload is missing value then error "Chybí údaje zprávy."
  set rawData to current application's NSData's alloc()'s initWithBase64EncodedString:payload options:0
  set messageData to current application's NSJSONSerialization's JSONObjectWithData:rawData options:0 |error|:(missing value)
  if messageData is missing value then error "Neplatná data zprávy."
  set fromAddress to (messageData's objectForKey:"from") as text
  if fromAddress is not "f.solar@fair-life.cz" and fromAddress is not "filip.solar@mantra-finance.cz" then error "Neznámý účet odesílatele."
  set toAddress to (messageData's objectForKey:"to") as text
  set titleText to (messageData's objectForKey:"subject") as text
  set bodyText to (messageData's objectForKey:"body") as text
  if toAddress contains return or toAddress contains linefeed or titleText contains return or titleText contains linefeed then error "Neplatná hlavička zprávy."
  set blindAddresses to messageData's objectForKey:"bcc"
  if blindAddresses is missing value then
   set blindAddresses to {}
  else
   set blindAddresses to blindAddresses as list
  end if
  repeat with blindAddress in blindAddresses
   if (blindAddress as text) contains return or (blindAddress as text) contains linefeed then error "Neplatný příjemce."
  end repeat
  set pdfFile to missing value
  set pdfDocument to messageData's objectForKey:"pdfDocument"
  if pdfDocument is not missing value and pdfDocument is not (current application's NSNull's null()) then set pdfFile to my makePDF(pdfDocument)
  tell application "Mail"
   set availableAddresses to {}
   repeat with mailAccount in accounts
    set availableAddresses to availableAddresses & (email addresses of mailAccount)
   end repeat
   if fromAddress is not in availableAddresses then error "V Apple Mailu není nastaven účet nebo alias " & fromAddress & ". Nejprve jej přidejte v nastavení Mailu."
   set draftMessage to make new outgoing message with properties {subject:titleText, content:bodyText & linefeed, sender:fromAddress, visible:true}
   tell draftMessage
    if toAddress is not "" then make new to recipient at end of to recipients with properties {address:toAddress}
    repeat with blindAddress in blindAddresses
     make new bcc recipient at end of bcc recipients with properties {address:(blindAddress as text)}
    end repeat
   end tell
   if pdfFile is not missing value then
    tell content of draftMessage
     make new attachment with properties {file name:(POSIX file pdfFile)} at after the last paragraph
    end tell
   end if
   activate
  end tell
 on error errorText
  display dialog errorText buttons {"OK"} default button "OK" with title "FILIP CRM · Apple Mail"
 end try
end «event GURLGURL»

on run
 display dialog "Pomocník je připraven. V CRM u e-mailu zvolte Otevřít Apple Mail na Macu. Vytvoří pouze koncept se správnou adresou odesílatele. Zprávu nikdy sám neodešle." buttons {"OK"} default button "OK" with title "FILIP CRM · Apple Mail"
end run

-- Render locally in an isolated Chrome profile. No client document goes to a server.
on makePDF(pdfDocument)
 set htmlText to (pdfDocument's objectForKey:"html") as text
 if (length of htmlText) > 250000 then error "Výpověď je příliš velká. Použijte uložení PDF a ruční přílohu."
 set chromePath to "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 set fileManager to current application's NSFileManager's defaultManager()
 if not (fileManager's fileExistsAtPath:chromePath) then error "Pro automatické PDF je potřeba Google Chrome. PDF můžete také uložit z náhledu a přiložit ručně."
 set workDir to do shell script "/usr/bin/mktemp -d /private/tmp/filip-crm-letter.XXXXXXXX"
 set htmlPath to workDir & "/letter.html"
 set attachmentName to ((pdfDocument's objectForKey:"name")'s lastPathComponent()) as text
 if attachmentName does not end with ".pdf" or (length of attachmentName) > 150 then error "Neplatný název PDF."
 set pdfPath to workDir & "/" & attachmentName
 set htmlText to "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\">" & htmlText
 set htmlData to (current application's NSString's stringWithString:htmlText)'s dataUsingEncoding:(current application's NSUTF8StringEncoding)
 if not (htmlData's writeToFile:htmlPath atomically:true) then error "Nepodařilo se připravit PDF."
 try
  do shell script quoted form of chromePath & " --headless --disable-gpu --disable-extensions --disable-background-networking --no-first-run --no-default-browser-check --no-pdf-header-footer --host-resolver-rules='MAP * ~NOTFOUND' --user-data-dir=" & quoted form of (workDir & "/profile") & " --print-to-pdf=" & quoted form of pdfPath & " " & quoted form of ("file://" & htmlPath) & " >/dev/null 2>&1"
 on error
  error "PDF se nepodařilo vytvořit. E-mail nebyl otevřen; zkuste to znovu nebo PDF přiložte ručně."
 end try
 set pdfData to current application's NSData's dataWithContentsOfFile:pdfPath
 if pdfData is missing value then error "PDF nebylo vytvořeno."
 if (pdfData's |length|() as integer) < 100 then error "Vytvořené PDF není platné."
 fileManager's removeItemAtPath:htmlPath |error|:(missing value)
 fileManager's removeItemAtPath:(workDir & "/profile") |error|:(missing value)
 return pdfPath
end makePDF
