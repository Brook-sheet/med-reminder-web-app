// lib/emailValidation.ts
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// ── Expanded disposable/temporary email blocklist ─────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.info','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.net','guerrillamail.org','guerrillamailblock.com',
  'grr.la','sharklasers.com','spam4.me','trashmail.com','trashmail.me',
  'trashmail.net','trashmail.at','trashmail.io','trashmail.xyz',
  'tempmail.com','temp-mail.org','temp-mail.io','tempinbox.com',
  'throwaway.email','throwam.com','discard.email','dispostable.com',
  'mailnull.com','spamgourmet.com','spamgourmet.net','spamspot.com',
  'fakeinbox.com','maildrop.cc','mailsac.com','yopmail.com','yopmail.fr',
  'cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj',
  'speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
  'monmail.fr.nf','10minutemail.com','10minutemail.net','10minutemail.org',
  '10minutemail.de','10minutemail.ru','10minutemail.be','10minutemail.co.uk',
  'tempr.email','getnada.com','mohmal.com','spamfree24.org','spamfree24.de',
  'spamfree24.net','spamfree24.info','spamfree24.biz','spamfree24.eu',
  'spamgob.com','mailmetrash.com','maileater.com','mail-temporaire.fr',
  'filzmail.com','discard.email','spamoff.de','superrito.com',
  'getonemail.com','binkmail.com','bobmail.info','chammy.info',
  'devnullmail.com','deagot.com','dramaticdancer.com','emailthe.net',
  'emailto.de','ephemail.net','fakemailgenerator.com','fastacura.com',
  'fastchevy.com','fastchrysler.com','fastkawasaki.com','fastmazda.com',
  'fastnissan.com','fastsubaru.com','fastsuzuki.com','fasttoyota.com',
  'fastyamaha.com','fizmail.com','get2mail.fr','getonemail.net',
  'ghosttexter.de','girlsundertheinfluence.com','gowikibooks.com',
  'gowikicampus.com','gowikicars.com','gowikifilms.com','gowikigames.com',
  'gowikimusic.com','gowikinetwork.com','gowikitravel.com','gowikitv.com',
  'haltospam.com','ieatspam.eu','ieatspam.info','inboxclean.com',
  'jetable.com','jetable.net','jetable.org','jetable.pp.ua','jnxjn.com',
  'jourrapide.com','kasmail.com','koszmail.pl','kurzepost.de','letthemeatspam.com',
  'lhsdv.com','link2mail.net','lol.ovpn.to','lookugly.com','lortemail.dk',
  'lr78.com','maileater.com','mailezee.com','mailme.gq','mailme.ir',
  'mailme.lol','mailme24.com','mailmetrash.com','mailmoat.com','mailscrap.com',
  'mailslapping.com','mailzilla.org','makemetheking.com','mbx.cc',
  'mega.zik.dj','meltmail.com','messagebeamer.de','mierdamail.com',
  'moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf','mt2009.com',
  'mt2014.com','mypartyclip.de','myphantomemail.com','mysamp.de',
  'netmails.com','netmails.net','neverbox.com','no-spam.ws','noblepioneer.com',
  'nomail.pw','nomail.xl.cx','nomail2me.com','nomorespamemails.com',
  'nospam.ze.tc','nospamfor.us','nospammail.net','nospamthanks.info',
  'nowmymail.com','okrent.us','oneoffmail.com','onewaymail.com',
  'oopi.org','ordinemail.it','pookmail.com','powered.name','privacy.net',
  'proxymail.eu','prtnx.com','punkass.com','putthisinyourspamdatabase.com',
  'quickinbox.com','rcpt.at','reallymymail.com','recode.me','recursor.net',
  'regbypass.com','regbypass.comsafe-mail.net','rmqkr.net','rppkn.com',
  's0ny.net','safe-mail.net','safetymail.info','safetypost.de',
  'sandelf.de','schafmail.de','schrott-mail.de','secretemail.de',
  'secure-mail.biz','shortmail.net','sibmail.com','sneakemail.com',
  'sneakmail.de','snkmail.com','sofimail.com','sofortmail.de',
  'soodonims.com','spam.la','spam.mn','spam.su','spam4.me',
  'spamavert.com','spambob.com','spambob.net','spambob.org',
  'spambog.com','spambog.de','spambog.ru','spambox.info','spambox.us',
  'spamcannon.com','spamcannon.net','spamcero.com','spamcon.org',
  'spamcorptastic.com','spamcowboy.com','spamcowboy.net','spamcowboy.org',
  'spamday.com','spamdecoy.net','spamex.com','spamfree.eu',
  'spamgoes.in','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'spamherelots.com','spamhereplease.com','spamhole.com','spamify.com',
  'spaminator.de','spamkill.info','spaml.com','spaml.de','spammotel.com',
  'spammy.host','spamoff.de','spamslicer.com','spamstack.net',
  'spamthis.co.uk','spamthisplease.com','spamtrail.com','spamtroll.net',
  'speed.1s.fr','spoofmail.de','stuffmail.de','super-auswahl.de',
  'supergreatmail.com','supermailer.jp','superrito.com','superstachel.de',
  'suremail.info','svk.jp','sweetxxx.de','tafmail.com','tagyourself.com',
  'teewars.org','teleworm.com','teleworm.us','tempalias.com',
  'tempail.com','tempemail.biz','tempemail.co.za','tempemail.com',
  'tempemail.net','tempinbox.co.uk','tempinbox.com','tempmail.com',
  'tempmail.de','tempmail.it','tempmail.net','tempmail.us',
  'tempomail.fr','temporaryemail.net','temporaryemail.us',
  'temporaryforwarding.com','temporaryinbox.com','temporarymailaddress.com',
  'tempthe.net','thankyou2010.com','thecloudindex.com','thisisnotmyrealemail.com',
  'throwam.com','throwaway.email','throwjunk.com','tilien.com',
  'tMailinator.com','tMtail.com','trbvm.com','trialmail.de',
  'trucklovesmail.com','ttmail.com','turual.com','twinmail.de',
  'tyldd.com','uggsrock.com','uroid.com','us.af','veryrealemail.com',
  'viditag.com','vomoto.com','vubby.com','walala.org','walkmail.ru',
  'webemail.me','webm4il.info','weg-werf-email.de','wegwerf-emails.de',
  'wegwerfadresse.de','wegwerfemail.com','wegwerfemail.de','wegwerfemail.net',
  'wegwerfemail.org','wegwerfmail.de','wegwerfmail.info','wegwerfmail.net',
  'wegwerfmail.org','wetrainbayarea.com','wetrainbayarea.org',
  'wh4f.org','whyspam.me','wickmail.net','wil.kr','willhackforfood.biz',
  'willselfdestruct.com','winemaven.info','wronghead.com',
  'wuzupmail.net','www.e4ward.com','www.mailinator.com','wwwnew.eu',
  'xagloo.com','xemaps.com','xents.com','xmaily.com','xoxy.net',
  'xyzfree.net','yapped.net','yeah.net','yep.it','yogamaven.com',
  'yopmail.com','yopmail.fr','yourdomain.com','yuurok.com',
  'z1p.biz','za.com','zeek.com','zetmail.com','zippymail.info',
  'zoemail.net','zoemail.org','zomg.info','zxcv.com','zxcvbnm.com',
  'zzz.com',
]);

// ── Known legitimate email providers (always allow) ──────────────
const TRUSTED_PROVIDERS = new Set([
  'gmail.com','googlemail.com',
  'yahoo.com','yahoo.co.uk','yahoo.co.ph','yahoo.com.ph',
  'outlook.com','hotmail.com','hotmail.co.uk','live.com',
  'msn.com','microsoft.com',
  'icloud.com','me.com','mac.com',
  'protonmail.com','proton.me',
  'zoho.com','zohomail.com',
  'aol.com',
  'mail.com','email.com',
  'gmx.com','gmx.net','gmx.de',
  'fastmail.com','fastmail.fm',
  'tutanota.com','tuta.io',
  'hey.com',
  'pm.me',
  'up.edu.ph','dlsu.edu.ph','ateneo.edu.ph','admu.edu.ph',
  'pup.edu.ph','ust.edu.ph','feu.edu.ph','mapua.edu.ph',
  'edu.ph','gov.ph','com.ph',
]);

// ── Patterns that are obviously fake/test ─────────────────────────
const FAKE_PATTERNS = [
  /^test[@+]/i,
  /^fake[@+]/i,
  /^sample[@+]/i,
  /^example[@+]/i,
  /^dummy[@+]/i,
  /^noreply[@+]/i,
  /^no-reply[@+]/i,
  /^admin[@+]/i,
  /^user[@+]/i,
  /^user\d+[@+]/i,
  /^aaa+[@+]/i,
  /^bbb+[@+]/i,
  /^xxx+[@+]/i,
  /^abc[@+]/i,
  /^123[@+]/i,
  /^asdf[@+]/i,
  /^qwer[@+]/i,
  /^zxcv[@+]/i,
  /^(.)\1{4,}[@+]/i,  // 5+ repeated characters e.g. aaaaa@
];

// ── Strict RFC-compliant format check ────────────────────────────
function isValidFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;

  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return false;

  const [local, domain] = email.split('@');
  if (local.length > 64) return false;
  if (!domain || domain.length > 255) return false;

  // No consecutive dots
  if (email.includes('..')) return false;

  // Local part cannot start or end with a dot
  if (local.startsWith('.') || local.endsWith('.')) return false;

  return true;
}

function hasFakePattern(email: string): boolean {
  return FAKE_PATTERNS.some((pattern) => pattern.test(email));
}

function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

// ── MX record lookup — confirms the domain can receive email ──────
async function hasMxRecord(domain: string): Promise<boolean> {
  // Skip DNS lookup for known trusted providers (faster)
  if (TRUSTED_PROVIDERS.has(domain.toLowerCase())) return true;

  try {
    const records = await resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    // DNS lookup failed — domain likely doesn't exist
    return false;
  }
}

// ── Main validation function ─────────────────────────────────────
export async function validateEmail(email: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const trimmed = email.trim().toLowerCase();

  // 1. Format check
  if (!isValidFormat(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const domain = trimmed.split('@')[1];

  // 2. Disposable domain check
  if (isDisposable(domain)) {
    return {
      valid: false,
      error:
        'Temporary or disposable email addresses are not allowed. Please use a real email account (e.g. Gmail, Yahoo, Outlook).',
    };
  }

  // 3. Fake pattern check
  if (hasFakePattern(trimmed)) {
    return {
      valid: false,
      error:
        'This email address does not appear to be real. Please use your actual email account.',
    };
  }

  // 4. MX record check — confirms the domain actually receives email
  const hasMx = await hasMxRecord(domain);
  if (!hasMx) {
    return {
      valid: false,
      error:
        'The email domain does not appear to exist or cannot receive emails. Please use a valid email address.',
    };
  }

  return { valid: true };
}
