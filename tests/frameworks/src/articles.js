// Shared by every framework fixture. No quotes or apostrophes, so the website
// loader's smart quotes leave the text byte-for-byte equal to the framework's.
export const articles = [
  { name: 'Dana', flag: true, extra: ' Then write down one honest sentence about how the morning went.', lead: 'Read the notes in', link: 'the neighborhood gallery guide', tail: 'before you plan a visit, because the opening hours change with the seasons and the weather.',
    body: 'Small habits compound quietly. A glass of water before coffee, ten minutes of daylight before screens, and one honest note about how you feel will change the shape of an ordinary week.' },
  { name: 'Rui', flag: false, extra: ' Sleep is where the body settles its accounts.', lead: 'Community clinics in', link: 'every county of the state', tail: 'now offer free testing on weekends, and no appointment is needed for walk-in visits.',
    body: 'Update: drink water.' },
  { name: 'Priyanka', flag: true, extra: ' The stairs are there when the elevator is slow.', lead: 'Our volunteers built', link: 'a wellness data dashboard for every clinic', tail: 'and published the results openly for anyone to review at any time of day.',
    body: 'Rest is not a reward for finishing everything on your list. It is the condition that makes the list possible, and the body keeps its own careful ledger of every skipped night.' },
  { name: 'Ada', flag: false, extra: ' Movement is a habit of attention.', lead: 'Take', link: 'the long way home', tail: 'through the market before the stalls close.',
    body: 'Take the stairs when the elevator is slow, walk the long way to the train, and let the afternoon light find you before the evening news does. Movement is a habit of attention, not a chore.' },
  { name: 'Mo', flag: true, extra: ' A short walk after lunch helps more than a long one on Sunday.', lead: 'Visit', link: 'the collection', tail: 'to read the original accounts of the neighborhood as it changed over time.',
    body: 'Every morning the corner shop puts out a small chalkboard with the price of bread, and the regulars read it before they even say hello to anyone behind the counter.' },
];

/** The text each paragraph must show for article i, as the framework rendered it. */
export function expected(i) {
  const a = articles[i];
  return { sole: a.body, mixed: 'Hello ' + a.name + ', ' + a.body, linked: a.lead + ' ' + a.link + ' ' + a.tail, cond: a.body + (a.flag ? a.extra : '') };
}
