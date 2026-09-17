import { typeset, mount, smartQuotes, styleProseLists, auditJSON, composeParagraph } from 'typeset.us';
const source: string = smartQuotes('"A room for listening."');
const controller = mount(document, 'p', { smartQuotes: 'en', opticalHanging: true });
const report: boolean = auditJSON('p').pass;
const lists = styleProseLists(document);
typeset(document.createElement('p'), { lineBreaks: 'legacy' });
void [source, controller, report, lists, composeParagraph];
