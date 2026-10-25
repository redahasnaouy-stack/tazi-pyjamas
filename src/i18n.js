import arabic from './ar.js';
let language='fr';
try{if(typeof window!=='undefined'&&window.localStorage.getItem('tazi-language')==='ar')language='ar'}catch{}
export const getLanguage=()=>language;
export function setLanguage(value){
 language=value==='ar'?'ar':'fr';
 try{if(typeof window!=='undefined')window.localStorage.setItem('tazi-language',language)}catch{}
 if(typeof document!=='undefined'){
  document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
  document.title=language==='ar'?'طازي بيجامات — أناقة وراحة لكل ليلة':"Tazi Pyjamas — L'art de se sentir bien";
  document.querySelector('meta[name="description"]')?.setAttribute('content',language==='ar'?'طازي بيجامات: اكتشفي تشكيلتنا من البيجامات النسائية بأسعار من 200 إلى 350 درهماً، مع التوصيل داخل المغرب والدفع عند الاستلام.':'Tazi Pyjamas — Des pyjamas féminins, du satin et de la douceur. Découvrez notre collection de 200 à 350 DH.');
 }
}
export function translate(value,lang=language){
 const text=String(value);if(lang!=='ar')return text;
 const key=text.trim();const leading=text.match(/^\s*/)[0],trailing=text.match(/\s*$/)[0];
 const done=value=>leading+value+trailing;
 if(Object.hasOwn(arabic,key))return done(arabic[key]);
 let match;
 if((match=key.match(/^Stock (S|M|L|XL)$/)))return done(`مخزون ${match[1]}`);
 if((match=key.match(/^(\d+) sur (\d+) pièces$/)))return done(`${match[1]} من أصل ${match[2]} قطعة`);
 if((match=key.match(/^(\d+) pièces · Une infinité de jolis moments$/)))return done(`${match[1]} قطعة · لحظات جميلة بلا حدود`);
 if((match=key.match(/^(.+) ajouté au panier$/)))return done(`تمت إضافة ${translate(match[1],lang)} إلى السلة`);
 if((match=key.match(/^(Découvrir|Favori) (.+)$/)))return done(`${match[1]==='Découvrir'?'اكتشفي':'إضافة إلى المفضلة:'} ${translate(match[2],lang)}`);
 if((match=key.match(/^Voir la photo (\d+) de (.+)$/)))return done(`عرض الصورة ${match[1]} من ${translate(match[2],lang)}`);
 if((match=key.match(/^Taille (S|M|L|XL) · (.+)$/)))return done(`المقاس ${match[1]} · ${translate(match[2],lang)}`);
 if((match=key.match(/^(\d+) DH$/)))return done(`${match[1]} درهم`);
 if((match=key.match(/^(.+) \/ (S|M|L|XL) × (\d+)$/)))return done(`${translate(match[1],lang)} / ${match[2]} × ${match[3]}`);
 if((match=key.match(/^Votre demande (.+) a bien été enregistrée\. La boutique vous contactera pour la confirmer\.$/)))return done(`تم تسجيل طلبك ${match[1]} بنجاح. سنتواصل معك لتأكيده.`);
 if(key.endsWith('. Une tenue pour accompagner vos instants de détente.'))return done(translate(key.slice(0,-'. Une tenue pour accompagner vos instants de détente.'.length),lang)+'. '+arabic['Une tenue pour accompagner vos instants de détente.']);
 if(key.includes(' — '))return done(key.split(' — ').map(part=>translate(part,lang)).join(' — '));
 if((match=key.match(/^© (\d+) Tazi Pyjamas$/)))return done(`© ${match[1]} طازي بيجامات`);
 return text;
}
export function localize(markup){
 if(language!=='ar')return markup;
 const template=document.createElement('template');template.innerHTML=markup;
 const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);
 for(let node;node=walker.nextNode();){if(!node.parentElement?.closest('[data-no-translate],script,style,textarea'))node.nodeValue=translate(node.nodeValue)}
 for(const element of template.content.querySelectorAll('[aria-label],[placeholder],[title],[alt],input,textarea')){
  if(element.closest('[data-no-translate]'))continue;
  for(const attr of ['aria-label','placeholder','title','alt'])if(element.hasAttribute(attr))element.setAttribute(attr,translate(element.getAttribute(attr)));
  if(element.matches('input,textarea'))element.dir=['email','tel','password'].includes(element.type)?'ltr':'auto';
 }
 return template.innerHTML;
}
export function languageSwitcher(){return `<div class="language-switch" role="group" aria-label="${language==='ar'?'اختيار اللغة':'Choisir la langue'}" data-no-translate><button type="button" data-language="fr" lang="fr" aria-label="Français" aria-pressed="${language==='fr'}">FR</button><button type="button" data-language="ar" lang="ar" aria-label="العربية" aria-pressed="${language==='ar'}">العربية</button></div>`}
export function errorText(message){const translated=translate(message);return language==='ar'&&translated===message&&/[a-zA-Z]/.test(message)?translate('Une erreur est survenue. Réessayez.'):translated}
