import type { Database } from './types'

type GameRow = Database['public']['Tables']['games']['Row']

/**
 * Strips common suffixes, school words, and punctuation to produce a
 * bare token used for fuzzy matching between NCAA API names and DB team names.
 *
 * Ported from main_sheet_GAS fuzzy match logic (lines 272-290).
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    // Known aliases — map to a canonical form before stripping
    .replace(/\bconn\b/g, 'connecticut')
    .replace(/\buconn\b/g, 'connecticut')
    .replace(/\blsu\b/g, 'louisiana state')
    .replace(/\bsmu\b/g, 'southern methodist')
    .replace(/\bvcu\b/g, 'virginia commonwealth')
    .replace(/\bucla\b/g, 'california los angeles')
    .replace(/\busc\b/g, 'southern california')
    .replace(/\bunc\b/g, 'north carolina')
    // Normalize St. / Saint
    .replace(/\bst\.\s*/g, 'saint ')
    .replace(/\bst\b/g, 'saint')
    // Strip university/college words
    .replace(/\buniversity\b/g, '')
    .replace(/\buniv\b\.?/g, '')
    .replace(/\bcollege\b/g, '')
    // Strip common mascots / nicknames
    .replace(
      /\b(wildcats?|blue\s*devils?|huskies|husky|tigers?|bulldogs?|lions?|volunteers?|jayhawks?|tar\s*heels?|wolfpack|wolf\s*pack|crimson\s*tide|fighting\s*irish|longhorns?|buckeyes?|hoosiers?|spartans?|wolverines?|hawkeyes?|cyclones?|gators?|gophers?|cornhuskers?|huskers?|sooners?|cowboys?|horned\s*frogs?|aggies?|razorbacks?|mountaineers?|cavaliers?|hokies?|demon\s*deacons?|eagles?|falcons?|bears?|badgers?|illini|boilermakers?|terrapins?|terps?|golden\s*gophers?|golden\s*bears?|golden\s*flashes?|golden\s*eagles?|blue\s*jays?|cardinals?|bruins?|cougars?|rams?|mustangs?|rebels?|trojans?|seminoles?|nittany\s*lions?|orangemen?|orange|red\s*raiders?|horns?|toreros?|flyers?|retrievers?|retrievers?|anteaters?|banana\s*slugs?)\b/g,
      ''
    )
    // Strip state
    .replace(/\bstate\b/g, '')
    // Strip non-alphanumeric
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Given NCAA API home/away team names and a game date, find the best matching
 * game from a list of DB games.
 *
 * Matching strategy (in order):
 * 1. Exact normalized match on both home and away teams
 * 2. One team exact + one team substring match
 * 3. Both teams substring match
 *
 * Returns the matched game or null if no confident match is found.
 */
export function matchNcaaGameToDbGame(
  ncaaHome: string,
  ncaaAway: string,
  gameDate: string,
  dbGames: GameRow[]
): GameRow | null {
  const normHome = normalizeTeamName(ncaaHome)
  const normAway = normalizeTeamName(ncaaAway)

  // Filter to same date first
  const sameDayGames = dbGames.filter((g) => g.game_date === gameDate)

  const ncaaHomeExact = ncaaHome.toLowerCase().replace(/\s+/g, '')
  const ncaaAwayExact = ncaaAway.toLowerCase().replace(/\s+/g, '')

  for (const game of sameDayGames) {
    const dbHomeExact = game.home_team.toLowerCase().replace(/\s+/g, '')
    const dbAwayExact = game.away_team.toLowerCase().replace(/\s+/g, '')

    // Level 1: both exact (lowercased, whitespace-stripped)
    if (dbHomeExact === ncaaHomeExact && dbAwayExact === ncaaAwayExact) return game
    // Level 1b: swapped (shouldn't happen but defensive)
    if (dbHomeExact === ncaaAwayExact && dbAwayExact === ncaaHomeExact) return game
  }

  for (const game of sameDayGames) {
    const dbHome = normalizeTeamName(game.home_team)
    const dbAway = normalizeTeamName(game.away_team)

    // Level 2: one exact + one substring
    const homeMatch =
      dbHome === normHome || dbHome.includes(normHome) || normHome.includes(dbHome)
    const awayMatch =
      dbAway === normAway || dbAway.includes(normAway) || normAway.includes(dbAway)

    if (homeMatch && awayMatch) return game

    // Try swapped
    const homeMatchSwap =
      dbHome === normAway || dbHome.includes(normAway) || normAway.includes(dbHome)
    const awayMatchSwap =
      dbAway === normHome || dbAway.includes(normHome) || normHome.includes(dbAway)

    if (homeMatchSwap && awayMatchSwap) return game
  }

  return null
}
