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
  if blindAddresses is missing value then set blindAddresses to {}
  repeat with blindAddress in blindAddresses
   if (blindAddress as text) contains return or (blindAddress as text) contains linefeed then error "Neplatný příjemce."
  end repeat
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
   activate
  end tell
 on error errorText
  display dialog errorText buttons {"OK"} default button "OK" with title "FILIP CRM · Apple Mail"
 end try
end «event GURLGURL»

on run
 display dialog "Pomocník je připraven. V CRM u e-mailu zvolte Otevřít Apple Mail na Macu. Vytvoří pouze koncept se správnou adresou odesílatele. Zprávu nikdy sám neodešle." buttons {"OK"} default button "OK" with title "FILIP CRM · Apple Mail"
end run
