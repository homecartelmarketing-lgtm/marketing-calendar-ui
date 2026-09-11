import fs from "fs"
import path from "path"

export const MARKETING_AUTOMATION_DIR =
  process.env.MARKETING_AUTOMATION_DIR || "C:\\Users\\User\\marketing-automation"

export function loadAutomationEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const envPath = path.join(MARKETING_AUTOMATION_DIR, ".env")
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const idx = trimmed.indexOf("=")
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim()
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
          out[key] = val
        }
      }
    } catch (e) {
      console.error("Error reading automation .env:", e)
    }
  }

  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined) {
      out[key] = val
    }
  }

  return out
}

export const autoEnv = loadAutomationEnv()

export const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN || autoEnv.AIRTABLE_TOKEN || ""

export const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || autoEnv.AIRTABLE_BASE_ID || "appDM0jUDsaiThtR3"

export type TableTarget = {
  tableId: string
  category: "Feeds" | "Stories" | "Reels"
  idea: string
  fixtureType?: string
}

export function getAllConfiguredTables(): TableTarget[] {
  const env = autoEnv
  const targets: TableTarget[] = [
    // --- STORIES ---
    // CTA Story
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_CTA || "tblYHdVq14FjMWg5o", category: "Stories", idea: "CTA Story", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_CTA || "tblSpGJLO3faYfIDY", category: "Stories", idea: "CTA Story", fixtureType: "Cluster Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_CTA || "tblfl7fqFZa2vUieB", category: "Stories", idea: "CTA Story", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_CTA || "tblKJeCCp4zQ6g7Em", category: "Stories", idea: "CTA Story", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMP_CTA || "tblPKSYyjgbgMypE2", category: "Stories", idea: "CTA Story", fixtureType: "Floor Lamp" },

    // Moodboard Story / Styled Photo
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_STORY || "tblHQrci8d1K9ws2M", category: "Stories", idea: "Moodboard Story", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_STORY || "tblkm119i48y0M1IQ", category: "Stories", idea: "Moodboard Story", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_STORY || "tblBaNeiSZeYrUawW", category: "Stories", idea: "Moodboard Story", fixtureType: "Floor Lamp" },

    // Day & Night Story
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_NIGHT_STORY || "tblKkCf88UVQ3Yu07", category: "Stories", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_STORY || "tblaNyYZCR7E6TXtv", category: "Stories", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_STORY || "tblr1hlsjGcs9QKCy", category: "Stories", idea: "Day & Night", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_STORY || "tblhvM9Saq18YqONB", category: "Stories", idea: "Day & Night", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_DAY_NIGHT_STORY || "tblgcvB4WFKOpSIQl", category: "Stories", idea: "Day & Night", fixtureType: "Cluster Chandelier" },

    // Tips & Educational Story
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIERS_TIPS_EDU_STORY || "tblpFiaNn1Ym9fTTk", category: "Stories", idea: "Tips & Educational", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIERS_TIPS_EDU_STORY || "tbllzkE2prSyj9BaD", category: "Stories", idea: "Tips & Educational", fixtureType: "Cluster Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_TIPS_EDU_STORY || "tblwnFN5a8fLzKuP4", category: "Stories", idea: "Tips & Educational", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_TIPS_EDU_STORY || "tblZtENqILDAekLv2", category: "Stories", idea: "Tips & Educational", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_TIPS_EDU_STORY || "tblJxWwZexgBHl26B", category: "Stories", idea: "Tips & Educational", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_CEILING_MOUNTED_TIPS_EDU_STORY || "tblGlRibUZXB9R3Gt", category: "Stories", idea: "Tips & Educational", fixtureType: "Ceiling Mounted" },

    // Collection Category Story
    { tableId: "tblJMJQlrnlDb1GtN", category: "Stories", idea: "Collection Category", fixtureType: "Chandelier" },
    { tableId: "tblSSVJnubFk2yBm3", category: "Stories", idea: "Collection Category", fixtureType: "Pendant Light" },
    { tableId: "tblloZLRSKwOCg247", category: "Stories", idea: "Collection Category", fixtureType: "Floor Lamp" },
    { tableId: "tblsXXcoZZD4q6WWt", category: "Stories", idea: "Collection Category", fixtureType: "Cluster Chandelier" },
    { tableId: "tbl98UU0h4uFyFIlL", category: "Stories", idea: "Collection Category", fixtureType: "Wall Light" },

    // Product Closeup w/ Description Story
    { tableId: "tblDcT6jovdAbKnfw", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Chandelier" },
    { tableId: "tblDD2w4v0Idb4jAZ", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Pendant Light" },
    { tableId: "tblPvHyKGByWJCMtY", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Floor Lamp" },
    { tableId: "tblnIOQVywHcTgAtv", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Cluster Chandelier" },
    { tableId: "tbl5S9JEHSrjrLwxA", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Table Lamp" },
    { tableId: "tblYqudlgjYMNRROM", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Wall Light" },

    // Product Closeup w/ Specifications Story
    { tableId: "tblEGTB6BodRVDqBV", category: "Stories", idea: "Product Closeup w/ specifications", fixtureType: "Chandelier" },

    // Myth & Fact Story
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_CHANDELIER || "tbl3OI7crWvN2Q7u6", category: "Stories", idea: "Myth & Fact", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_PENDANT_LIGHTS || "tblwBnWYRGcV6as45", category: "Stories", idea: "Myth & Fact", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_FLOOR_LAMPS || "tblf5Yaki4ktwiLtx", category: "Stories", idea: "Myth & Fact", fixtureType: "Floor Lamp" },

    // Style This Story
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_THIS_CHANDELIER || "tblYge5R7LwTJkEHC", category: "Stories", idea: "Style This", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_THIS_FLOOR_LAMPS || "tblvSAzXasTVI85r9", category: "Stories", idea: "Style This", fixtureType: "Floor Lamp" },

    // This or That Story
    { tableId: "tblo42IkuhYLIQBzk", category: "Stories", idea: "This or That", fixtureType: "Chandelier" },
    { tableId: "tblS1VHp41RDfxztD", category: "Stories", idea: "This or That", fixtureType: "Pendant Light" },
    { tableId: "tblaoqj8VPVHFmVQn", category: "Stories", idea: "This or That", fixtureType: "Floor Lamp" },
    { tableId: "tblYAhjKckXtjUayx", category: "Stories", idea: "This or That", fixtureType: "Cluster Chandelier" },
    { tableId: "tblm1Ty2QkAlUcHJt", category: "Stories", idea: "This or That", fixtureType: "Table Lamp" },
    { tableId: "tblZw6jvSa27oZDiN", category: "Stories", idea: "This or That", fixtureType: "Wall Light" },

    // --- FEEDS ---
    // 1 Product, 3 Styles Feed
    { tableId: "tblrlfqBGe5EjS5PI", category: "Feeds", idea: "1 Product, 3 Styles", fixtureType: "Chandelier" },
    { tableId: "tblRy52kCasisCWzd", category: "Feeds", idea: "1 Product, 3 Styles", fixtureType: "Pendant Light" },
    { tableId: "tbl9GIq2QeYCwMhWU", category: "Feeds", idea: "1 Product, 3 Styles", fixtureType: "Floor Lamp" },

    // Collection Category Feed
    { tableId: "tbl0R6o61lGJmt44n", category: "Feeds", idea: "Collection Category", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_COLLECTION_CATEGORY_FEED || "tbl5o1j3XvUaUqmjs", category: "Feeds", idea: "Collection Category" },

    // Day & Night Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_4_5 || "tblSceuLVvLMQ6wWp", category: "Feeds", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_FEED || "tblIgRlTtO7Y2EGIo", category: "Feeds", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_FEED || "tblcKHAVYgzIcmabT", category: "Feeds", idea: "Day & Night", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_FEED || "tbljsKOEhc0618qbM", category: "Feeds", idea: "Day & Night", fixtureType: "Table Lamp" },

    // Moodboard #1 Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_1_FEED || "tbl9u5vjgx8kuE44R", category: "Feeds", idea: "Moodboard #1", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_1_FEED || "tblOvvYdgsNTXh2zK", category: "Feeds", idea: "Moodboard #1", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_1_FEED || "tbl6uTmwM23KK9ocO", category: "Feeds", idea: "Moodboard #1", fixtureType: "Floor Lamp" },

    // Moodboard #2 Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED || "tbltWgQKOYjuHw6tx", category: "Feeds", idea: "Moodboard #2", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_2_FEED || "tbl4TiV90SzdBz4KG", category: "Feeds", idea: "Moodboard #2", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_2_FEED || "tbl4YF9iXlBqGblEc", category: "Feeds", idea: "Moodboard #2", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_WALL_LIGHTS_MOODBOARD_2_FEED || "tbljUk9JwzS1JeZJg", category: "Feeds", idea: "Moodboard #2", fixtureType: "Wall Light" },

    // Tips & Educational Feed
    { tableId: "tblQ65S51Dmauwx4c", category: "Feeds", idea: "Tips & Educational", fixtureType: "Chandelier" },
    { tableId: "tblIhCP3Gjg09QFCK", category: "Feeds", idea: "Tips & Educational", fixtureType: "Pendant Light" },
    { tableId: "tblQuhvktqYB59Ofw", category: "Feeds", idea: "Tips & Educational", fixtureType: "Floor Lamp" },
    { tableId: "tblwY6eGQCD5bJeF1", category: "Feeds", idea: "Tips & Educational", fixtureType: "Cluster Chandelier" },

    // Product Showcase Feed
    { tableId: env.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_TABLE_LAMP || "tbln0MNBaVVrZ0wrF", category: "Feeds", idea: "Product Showcase", fixtureType: "Table Lamp" },

    // --- REELS ---
    // 1 Product, 3 Styles Reel
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_ONE_PRODUCT_THREE_STYLES_REEL || "tbl6ls4AWcEcynBpZ", category: "Reels", idea: "1 Product, 3 Styles", fixtureType: "Chandelier" },
    { tableId: "tblRy52kCasisCWzd", category: "Reels", idea: "1 Product, 3 Styles", fixtureType: "Pendant Light" },
    { tableId: "tbl9GIq2QeYCwMhWU", category: "Reels", idea: "1 Product, 3 Styles", fixtureType: "Floor Lamp" },

    // Day & Night Reel
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_REEL || "tbl35JySlNuWh61tL", category: "Reels", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_AND_NIGHT_REEL || "tblkTuM627s2f0FTN", category: "Reels", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOORLAMP_DAY_AND_NIGHT_REEL || "tblVPgI4C6HEFcKW9", category: "Reels", idea: "Day & Night", fixtureType: "Floor Lamp" },
    { tableId: "tblAuIP2MveUzsOub", category: "Reels", idea: "Day & Night", fixtureType: "Cluster Chandelier" },
    { tableId: "tblDuIakWYYTJRrtv", category: "Reels", idea: "Day & Night", fixtureType: "Table Lamp" },

    // Before & After Reel
    { tableId: env.AIRTABLE_TABLE_ID_BEFORE_AFTER_CHANDELIER || "tbloMhCOngGDWFS2y", category: "Reels", idea: "Before & After", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_BEFORE_AFTER_PENDANT_LIGHTS || "tbleUP86Kw36G8Hdw", category: "Reels", idea: "Before & After", fixtureType: "Pendant Light" },

    // Moodboard Reel
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MODERN_MOODBOARDREEL || "tbl026zbECJJ9FRfj", category: "Reels", idea: "Moodboard Reel", fixtureType: "Chandelier" },
    { tableId: "tblpjRudEy6fobIrP", category: "Reels", idea: "Moodboard Reel", fixtureType: "Pendant Light" },
    { tableId: "tbli7nuOEhR8inzva", category: "Reels", idea: "Moodboard Reel", fixtureType: "Wall Light" },
    { tableId: "tblr0uAYkDWDQZinl", category: "Reels", idea: "Moodboard Reel", fixtureType: "Table Lamp" },
    { tableId: "tblJX6rd5nhhEuWbL", category: "Reels", idea: "Moodboard Reel", fixtureType: "Cluster Chandelier" },
    { tableId: "tblj4DVzllYa8pliK", category: "Reels", idea: "Moodboard Reel", fixtureType: "Linear Chandelier" },
    { tableId: "tblF3ot4fdHN2VCQn", category: "Reels", idea: "Moodboard Reel", fixtureType: "Floor Lamp" },

    // Style Reel Slideshow
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_REEL_SLIDESHOW || "tblFFEvkHb3jLKrcv", category: "Reels", idea: "Style Reel Slideshow" },

    // Product Closeup Reel
    { tableId: "tblqBZ946hVdOpmDV", category: "Reels", idea: "Product Closeup", fixtureType: "Table Lamp" },
    { tableId: "tblEGTB6BodRVDqBV", category: "Reels", idea: "Product Closeup", fixtureType: "Chandelier" },
  ]

  // Filter out any entries that do not have a valid tableId starting with 'tbl'
  const validTargets: TableTarget[] = []
  const seenTableIds = new Set<string>()

  for (const t of targets) {
    if (t.tableId && t.tableId.startsWith("tbl") && !seenTableIds.has(t.tableId)) {
      seenTableIds.add(t.tableId)
      validTargets.push(t)
    }
  }

  // Also include any other AIRTABLE_TABLE_ID_* present in env
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith("AIRTABLE_TABLE_ID_") && val && val.startsWith("tbl") && !seenTableIds.has(val)) {
      seenTableIds.add(val)
      validTargets.push({
        tableId: val,
        category: key.includes("STORY") ? "Stories" : key.includes("REEL") ? "Reels" : "Feeds",
        idea: key.replace("AIRTABLE_TABLE_ID_", "").replace(/_/g, " "),
      })
    }
  }

  return validTargets
}
