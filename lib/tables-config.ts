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
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_CTA || "tblYHdVq14FjMWg5o", category: "Stories", idea: "CTA", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_CTA || "tblSpGJLO3faYfIDY", category: "Stories", idea: "CTA", fixtureType: "Cluster Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_CTA || "tblfl7fqFZa2vUieB", category: "Stories", idea: "CTA", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_CTA || "tblKJeCCp4zQ6g7Em", category: "Stories", idea: "CTA", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMP_CTA || "tblPKSYyjgbgMypE2", category: "Stories", idea: "CTA", fixtureType: "Floor Lamp" },

    // Moodboard Styled Photo
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_STORY || "tblHQrci8d1K9ws2M", category: "Stories", idea: "Moodboard Styled Photo", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_STORY || "tblkm119i48y0M1IQ", category: "Stories", idea: "Moodboard Styled Photo", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_STORY || "tblBaNeiSZeYrUawW", category: "Stories", idea: "Moodboard Styled Photo", fixtureType: "Floor Lamp" },

    // Day & Night Story
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_NIGHT_STORY || "tblKkCf88UVQ3Yu07", category: "Stories", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_STORY || "tblaNyYZCR7E6TXtv", category: "Stories", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_STORY || "tblFLDayNightStory", category: "Stories", idea: "Day & Night", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_STORY || "tblTLDayNightStory", category: "Stories", idea: "Day & Night", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_DAY_NIGHT_STORY || "tblCCDayNightStory", category: "Stories", idea: "Day & Night", fixtureType: "Cluster Chandelier" },

    // Tips & Educational Story
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIERS_TIPS_EDU_STORY || "tblChandelierTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIERS_TIPS_EDU_STORY || "tblCCTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Cluster Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_TIPS_EDU_STORY || "tblPLTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_TIPS_EDU_STORY || "tblTLTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_TIPS_EDU_STORY || "tblFLTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_CEILING_MOUNTED_TIPS_EDU_STORY || "tblCMTipsStory", category: "Stories", idea: "Tips & Educational", fixtureType: "Ceiling Mounted" },

    // Product Closeup w/ Description Story
    { tableId: "tblDcT6jovdAbKnfw", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Chandelier" },
    { tableId: "tblDD2w4v0Idb4jAZ", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Pendant Light" },
    { tableId: "tblPvHyKGByWJCMtY", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Floor Lamp" },
    { tableId: "tblnIOQVywHcTgAtv", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Cluster Chandelier" },
    { tableId: "tbl5S9JEHSrjrLwxA", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Table Lamp" },
    { tableId: "tblYqudlgjYMNRROM", category: "Stories", idea: "Product Closeup w/ description", fixtureType: "Wall Light" },

    // Product Closeup w/ Specifications Story
    { tableId: "tblEGTB6BodRVDqBV", category: "Stories", idea: "Product Closeup w/ specifications" },

    // Myth & Fact Story
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_CHANDELIER || "tblMythFactChandelier", category: "Stories", idea: "Myth & Fact", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_PENDANT_LIGHTS || "tblMythFactPendant", category: "Stories", idea: "Myth & Fact", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_MYTH_AND_FACT_FLOOR_LAMPS || "tblMythFactFloor", category: "Stories", idea: "Myth & Fact", fixtureType: "Floor Lamp" },

    // Style This Story
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_THIS_CHANDELIER || "tblStyleThisChandelier", category: "Stories", idea: "Style This", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_THIS_FLOOR_LAMPS || "tblStyleThisFloor", category: "Stories", idea: "Style This", fixtureType: "Floor Lamp" },

    // This or That Story
    { tableId: "tblo42IkuhYLIQBzk", category: "Stories", idea: "This or That" },
    { tableId: "tblS1VHp41RDfxztD", category: "Stories", idea: "This or That" },
    { tableId: "tblaoqj8VPVHFmVQn", category: "Stories", idea: "This or That" },
    { tableId: "tblYAhjKckXtjUayx", category: "Stories", idea: "This or That" },
    { tableId: "tblm1Ty2QkAlUcHJt", category: "Stories", idea: "This or That" },
    { tableId: "tblZw6jvSa27oZDiN", category: "Stories", idea: "This or That" },

    // --- FEEDS ---
    // Day & Night Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_4_5 || "tblChandelierDNFeed", category: "Feeds", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_FEED || "tblPendantDNFeed", category: "Feeds", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_FEED || "tblFloorDNFeed", category: "Feeds", idea: "Day & Night", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_FEED || "tblTableDNFeed", category: "Feeds", idea: "Day & Night", fixtureType: "Table Lamp" },

    // Moodboard #2 Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED || "tbltWgQKOYjuHw6tx", category: "Feeds", idea: "Moodboard #2", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_2_FEED || "tblPLMoodboard2Feed", category: "Feeds", idea: "Moodboard #2", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_2_FEED || "tblFLMoodboard2Feed", category: "Feeds", idea: "Moodboard #2", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_WALL_LIGHTS_MOODBOARD_2_FEED || "tblWLMoodboard2Feed", category: "Feeds", idea: "Moodboard #2", fixtureType: "Wall Light" },

    // Moodboard #1 Feed
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_1_FEED || "tblChandelierMoodboard1", category: "Feeds", idea: "Moodboard #1", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_1_FEED || "tblPLMoodboard1", category: "Feeds", idea: "Moodboard #1", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_1_FEED || "tblFLMoodboard1", category: "Feeds", idea: "Moodboard #1", fixtureType: "Floor Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_MOODBOARD_1_FEED || "tblTLMoodboard1", category: "Feeds", idea: "Moodboard #1", fixtureType: "Table Lamp" },

    // Tips & Educational Feed
    { tableId: "tblQ65S51Dmauwx4c", category: "Feeds", idea: "Tips & Educational", fixtureType: "Chandelier" },
    { tableId: "tblIhCP3Gjg09QFCK", category: "Feeds", idea: "Tips & Educational", fixtureType: "Pendant Light" },
    { tableId: "tblQuhvktqYB59Ofw", category: "Feeds", idea: "Tips & Educational", fixtureType: "Floor Lamp" },
    { tableId: "tblwY6eGQCD5bJeF1", category: "Feeds", idea: "Tips & Educational", fixtureType: "Cluster Chandelier" },

    // Product Showcase Feed
    { tableId: env.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_TABLE_LAMP || "tbln0MNBaVVrZ0wrF", category: "Feeds", idea: "Product Showcase", fixtureType: "Table Lamp" },
    { tableId: env.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_CHANDELIER || "tblShowcaseChandelier", category: "Feeds", idea: "Product Showcase", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_PENDANT_LIGHTS || "tblShowcasePendant", category: "Feeds", idea: "Product Showcase", fixtureType: "Pendant Light" },

    // Collection Category Feed
    { tableId: env.AIRTABLE_TABLE_ID_COLLECTION_CATEGORY_FEED || "tblCollectionCatFeed", category: "Feeds", idea: "Collection Category" },

    // 1 Product 3 Styles Feed
    { tableId: env.AIRTABLE_TABLE_ID_1_PRODUCT_3_STYLES_FEED || "tbl1Prod3StylesFeed", category: "Feeds", idea: "1 Product, 3 Styles" },

    // --- REELS ---
    // Day & Night Reel
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_REEL || "tblChandelierDNReel", category: "Reels", idea: "Day & Night", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_AND_NIGHT_REEL || "tblPendantDNReel", category: "Reels", idea: "Day & Night", fixtureType: "Pendant Light" },
    { tableId: env.AIRTABLE_TABLE_ID_FLOORLAMP_DAY_AND_NIGHT_REEL || "tblFloorDNReel", category: "Reels", idea: "Day & Night", fixtureType: "Floor Lamp" },

    // Before & After Reel
    { tableId: env.AIRTABLE_TABLE_ID_BEFORE_AFTER_CHANDELIER || "tblBeforeAfterChandelier", category: "Reels", idea: "Before and After", fixtureType: "Chandelier" },
    { tableId: env.AIRTABLE_TABLE_ID_BEFORE_AFTER_PENDANT_LIGHTS || "tblBeforeAfterPendant", category: "Reels", idea: "Before and After", fixtureType: "Pendant Light" },

    // Moodboard Reel
    { tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MODERN_MOODBOARDREEL || "tblMoodboardReel", category: "Reels", idea: "Moodboard Reel", fixtureType: "Chandelier" },

    // Style Reel Slideshow
    { tableId: env.AIRTABLE_TABLE_ID_STYLE_REEL_SLIDESHOW || "tblStyleReelSlideshow", category: "Reels", idea: "Style Reel Slideshow" },

    // Closeup Reel
    { tableId: "tblqBZ946hVdOpmDV", category: "Reels", idea: "Product Closeup" },
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
