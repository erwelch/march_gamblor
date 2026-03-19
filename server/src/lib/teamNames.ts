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
 * 1. Same date, exact normalized match on both teams
 * 2. Same date, normalized substring match on both teams
 * 3. Similar date (±1 day), at least one team matches
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

  const ncaaHomeExact = ncaaHome.toLowerCase().replace(/\s+/g, '')
  const ncaaAwayExact = ncaaAway.toLowerCase().replace(/\s+/g, '')

  // Helper: check if two normalized team names match
  function teamsMatch(dbName: string, ncaaName: string): boolean {
    const normDb = normalizeTeamName(dbName)
    const normNcaa = normalizeTeamName(ncaaName)
    return normDb === normNcaa || normDb.includes(normNcaa) || normNcaa.includes(normDb)
  }

  // Helper: get date ±1 day
  function getNearbyDates(dateStr: string): string[] {
    const dates: string[] = [dateStr]
    const d = new Date(dateStr + 'T00:00:00Z')
    
    const prev = new Date(d)
    prev.setUTCDate(d.getUTCDate() - 1)
    dates.push(prev.toISOString().split('T')[0])

    const next = new Date(d)
    next.setUTCDate(d.getUTCDate() + 1)
    dates.push(next.toISOString().split('T')[0])

    return dates
  }

  // Filter to same date first
  const sameDayGames = dbGames.filter((g) => g.game_date === gameDate)

  // Level 1: Same day, both teams exact match
  for (const game of sameDayGames) {
    const dbHomeExact = game.home_team.toLowerCase().replace(/\s+/g, '')
    const dbAwayExact = game.away_team.toLowerCase().replace(/\s+/g, '')

    if (dbHomeExact === ncaaHomeExact && dbAwayExact === ncaaAwayExact) return game
    if (dbHomeExact === ncaaAwayExact && dbAwayExact === ncaaHomeExact) return game
  }

  // Level 2: Same day, both teams normalized match
  for (const game of sameDayGames) {
    const homeMatch = teamsMatch(game.home_team, ncaaHome)
    const awayMatch = teamsMatch(game.away_team, ncaaAway)

    if (homeMatch && awayMatch) return game

    // Try swapped
    const homeMatchSwap = teamsMatch(game.home_team, ncaaAway)
    const awayMatchSwap = teamsMatch(game.away_team, ncaaHome)

    if (homeMatchSwap && awayMatchSwap) return game
  }

  // Level 3: Similar date (±1 day), at least one team matches
  const nearbyDates = getNearbyDates(gameDate)
  const nearbyGames = dbGames.filter((g) => nearbyDates.includes(g.game_date))

  for (const game of nearbyGames) {
    const homeMatches = teamsMatch(game.home_team, ncaaHome)
    const awayMatches = teamsMatch(game.away_team, ncaaAway)
    const homeMatchesAway = teamsMatch(game.home_team, ncaaAway)
    const awayMatchesHome = teamsMatch(game.away_team, ncaaHome)

    // At least one team matches in either orientation
    if ((homeMatches || awayMatches) || (homeMatchesAway || awayMatchesHome)) {
      return game
    }
  }

  return null
}
