/**
 * Primary source records for each person in the archive.
 * These are sent to the Claude API as context for marginalia generation,
 * allowing the AI to notice gaps between the narrative on screen and
 * what the historical record actually says.
 */

export const primarySources = {
  'fay-watson': `# Fay Watson — Primary Source Record

## Identity
- **Age:** 23.
- **Charge:** Cocaine possession.
- **Date:** 24 March 1928.
- **Location:** Darlinghurst. House party raid.

## What Is Known
- Arrested alongside Elsie Paul.
- No City of Shadows entry.
- No Underworld blog entry.
- No newspaper coverage found.
- No biographical details beyond name, age, charge, date, location.

## Gaps Between Narrative and Record
- The narrative acknowledges the gaps openly: "What it doesn't tell us..."
- Everything beyond the four facts (name, age, charge, date) is fabulation or speculation.
- The speculation that Fay may have simply been at a party is not supported or contradicted by any record. We genuinely do not know.
- The record gives us almost nothing. The person existed. The archive barely noticed.`,

  'elsie-paul': `# Elsie Paul — Primary Source Record

## Identity
- **Age:** 21.
- **Charge:** Cocaine possession.
- **Date:** 24 March 1928.
- **Location:** Darlinghurst. House party raid.

## What Is Known
- Arrested alongside Fay Watson.
- No City of Shadows entry.
- No Underworld blog entry.
- No newspaper coverage found.
- No biographical details beyond name, age, charge, date, location.

## Gaps Between Narrative and Record
- Same as Fay Watson — the narrative acknowledges the gaps.
- The speculation that Elsie may have been a runner is not supported by any found record.
- The record gives us almost nothing. The person existed. The archive barely noticed.`,

  'edna-may': `# Edna May Lindsay — Primary Source Record

## Identity
- **Age:** 19.
- **Case:** #1765, 27 March 1929.
- **Charge:** Forgery.

## What Is Known
- Very limited public record found.
- No City of Shadows entry.
- No Underworld blog entry.
- No significant newspaper coverage found in initial search.

## What Needs Verification
- The boyfriend (age 18) and his involvement.
- The plan to become dancers.
- The amount of the forged check ("a year's salary").
- That both were released with a warning.
- The judge's quote: "dancing isn't everything."
- These details likely come from newspaper coverage on Trove that has not yet been located.

## Gaps Between Narrative and Record
- Nearly all specific details in the narrative (the dancing ambition, the boyfriend, the polka dots, the judge's quote) are either from an unlocated newspaper source or are fabulation.
- The record gives us: a name, an age, a charge, a date. Four facts. The narrative builds an entire character from them.
- If the newspaper source exists, it would significantly change the relationship between record and narrative — some of the "fabulation" may be journalism.`,

  'henry-pierce': `# Henry Pierce — Primary Source Record

## Identity
- **From:** Balmain, Sydney.
- **Age:** 35.
- **Occupation:** Masseur. Police records noted he sometimes worked with theatrical companies.

## Photograph
- **Case:** D95, 12 August 1929.
- **Charge:** Cocaine.

## Criminal Record
- **Prior form:** Safe breaking and wife desertion.
- **Role in raid:** Police said Pierce acted as offsider and bodyguard to cocaine seller Marie Elliott.
- **Arrested alongside:** Patsy Neill, Marie Elliott. Same raid.

## Key Detail
- Pierce claimed that the arresting police had hit him in the face and broken his nose.
- This is recorded as a claim, not a verified fact.

## Source
- City of Shadows blog, Sydney Living Museums / Museums of History NSW.

## Gaps Between Narrative and Record
- Narrative says "they broke his nose." Record says he *claimed* police broke his nose. The narrative presents allegation as fact.
- Narrative says "He knew how to wait in the wings." This is metaphor built on the theatrical connection. Not in the record.
- Record says "wife desertion." The narrative does not mention this.
- The narrative makes him stoic and cinematic. The record shows a man with a wife he abandoned.`,

  'marie-elliott': `# Marie Elliott — Primary Source Record

## Identity
- **Age:** 29.
- **Case:** D97, 12 August 1929.
- **Charge:** Cocaine.

## Criminal Record
- Police described her as a cocaine seller.
- Ran the operation from a flat on William Street.
- Henry Pierce was her offsider/bodyguard. Patsy Neill was involved in the same activities.
- Arrested in same raid as Pierce and Neill.

## What Is Known
- Almost nothing beyond the arrest itself.
- No City of Shadows entry with additional biography.
- No significant newspaper coverage found.

## Gaps Between Narrative and Record
- Narrative says "Saturday nights the theatre crowd came through." Not found in available records. May be fabulation based on Henry's theatrical connections.
- Narrative says "They even sold outside the courthouse. Sniffs for defendants before they faced the bench." Source unverified.
- Narrative says "The record doesn't say who she was before this. Or after." This is accurate. The record tells us almost nothing about Marie Elliott as a person.
- The narrative is honest about its own limits here. Most of the gaps are acknowledged.`,

  'patsy-neill': `# Patsy Neill — Primary Source Record

## Identity
- **Age:** 26.
- **Occupation:** Barmaid.

## Photograph
- **Criminal record number:** 781LB
- **Date:** 30 January 1930, State Reformatory for Women, Long Bay, NSW.
- **Charge:** Theft and possession of cocaine.

## Criminal Record
- Involved in various criminal activities including theft and selling cocaine.
- Arrested in same raid as Henry Pierce and Marie Elliott.

## Kate Leigh Incident (1932)
- Had a disagreement over money with the infamous sly grogger Kate Leigh, which led to Neill being threatened with a gun.
- Specific details (amount of money, whether Neill took Leigh to court) not confirmed in available records.

## Press Description
- Described in the press as "looking like a mannequin on parade."

## Source
- First published in *Femme Fatale: The Female Criminal*, Nerida Campbell, Historic Houses Trust of NSW, 2008, pp 124-125.
- City of Shadows blog, Sydney Living Museums.

## Gaps Between Narrative and Record
- Narrative says "Runner." Record says she was involved in selling cocaine but doesn't use the word runner.
- Narrative says "Two hundred fifty pounds. She paid it." Source unverified.
- Narrative says "two pounds" and "took her to court." Record says "disagreement over money" and "threatened with a gun." Specific details unverified.
- Narrative says "That was just a Tuesday." Fabulation — a punchline.
- The record says she looked "like a mannequin on parade." The narrative doesn't use this — a primary source detail more vivid than the invented ones.`,

  'nellie-cameron': `# Nellie Cameron — Primary Source Record

## Identity
- **Full name:** Ellen Katherine Kelly (birth name). Took stepfather's surname Cameron after mother remarried in 1922.
- **Born:** 1910, Waterloo, inner-city Sydney. Youngest child of Colin Kelly (later served in AIF, WWI) and Lillian Kelly (nee Ruddock).
- **Known aliases:** Ellen Kelly, Ellen Catherine Caletti, Ellen Katherine Bourke.
- **Religion:** Roman Catholic.
- **Education:** Exclusive girls' school on the North Shore.

## Photograph
- **Criminal record number:** 792LB
- **Date:** 29 July 1930, State Reformatory for Women, Long Bay, NSW. Age 21.
- **Charge at time of photograph:** Soliciting for immoral purposes. Arrested 14 May 1930 by Sergeant Lake.

## Criminal Record
- **Total convictions:** 73. Mainly for soliciting and vagrancy.
- **First woman in Australia** convicted under consorting laws (associating with known criminals).
- **Occupations listed:** Prostitute. Dance instructor at Professor Bolot's Academy, Oxford Street. Cocaine runner. Fence for stolen property.

## Background
- Ran away from home in 1926 at age 14-15.
- Caught a train to the city, seduced a married tram driver, began living with him in Woolloomooloo.
- Began sex work in 1926 in Surry Hills and Woolloomooloo.
- Became Sydney's most popular and most expensive sex worker.

## Physical Description
- Blue-eyed blonde (at start). Later described as "a redhead with a ripe figure and provocative china blue eyes."

## Violence Sustained
- Kidnapped, beaten, stabbed, razor slashed, and shot on numerous occasions.
- Shot in the back in 1931.
- Shot in the stomach by William Donohue in 1952. Surgery revealed several healed bullet wounds, some of which had become cancerous.

## Nicknames
- "The Kiss of Death Girl" / "The Angel of Death" — most of her boyfriends/husbands were subsequently murdered.
- "Sydney's Underworld Beauty Queen"

## Key Relationships
- **Norman Bruhn** (1894-1927): Melbourne gunman, first significant underworld lover. Shot dead, Charlotte Lane, Darlinghurst, 22 June 1927.
- **Guido Caletti/Calletti**: Razor gangster. Married Nellie 1934. Shot dead at a party, 1939.
- **Frank "the Little Gunman" Green**: On-again off-again relationship.
- **Charles Francis "Greyhound" Bourke** (1909-1964): Married 1940. Separated.
- **William Francis Donohue**: Shot her in 1952. She refused to give evidence against him.

## Death
- Committed suicide by gas asphyxiation at her Taylor Square flat, 8 November 1953, aged 41.
- Adopted a daughter named Janice.
- Buried as Ellen Katherine Bourke.

## What Others Said
- Lillian Armfield (Australia's first policewoman): Cameron had an "assured poise that set her apart from all the other women of the Australian underworld."

## Gaps Between Narrative and Record
- Narrative says "101 arrests." Record says 73 convictions.
- Narrative says "for refusing to disappear." The record does not say this.
- Narrative presents her as a young woman on the brink. The record shows a child who ran away at 14-15.
- The narrative mythologizes. The record dehumanizes. Neither is her.`,
}
