# Architecture: Graphify Knowledge Graph & Obsidian Integration

#architecture #knowledge-graph #graphify #obsidian

The codebase is mapped into a bidirectional knowledge graph using [Graphify](file:///C:/Users/User/.gemini/config/skills/graphify/SKILL.md) and connected directly to this Obsidian Memory Vault.

---

## 🗺️ Artifacts Generated

| Artifact | Location | Purpose |
| :--- | :--- | :--- |
| **Interactive Graph UI** | [`graphify-out/graph.html`](file:///C:/Users/User/Downloads/Marketing%20Output%20UI/graphify-out/graph.html) | Standalone visual HTML explorer with search, clusters, and god-node inspection |
| **Graph Report** | [`graphify-out/GRAPH_REPORT.md`](file:///C:/Users/User/Downloads/Marketing%20Output%20UI/graphify-out/GRAPH_REPORT.md) | Structural summary of 1,148+ AST nodes, 1,855+ edges, and 103 detected communities |
| **Obsidian Vault Canvas** | [`graphify-out/obsidian/graph.canvas`](file:///C:/Users/User/Downloads/Marketing%20Output%20UI/graphify-out/obsidian/graph.canvas) | Native Obsidian infinite visual canvas linking symbols and modules |
| **Graph Dataset** | [`graphify-out/graph.json`](file:///C:/Users/User/Downloads/Marketing%20Output%20UI/graphify-out/graph.json) | GraphRAG-ready JSON schema for agentic queries and shortest-path lookups |

---

## ⚡ Useful CLI Commands

```powershell
# Re-extract and update knowledge graph on code changes
python -m graphify update .

# Query code relationships via BFS
python -m graphify query "How does extractOutputMedia relate to Airtable tables?"

# Find shortest path between two modules/concepts
python -m graphify path "extractOutputMedia" "syncAirtableRecord"

# Re-export native Obsidian canvas and notes
python -m graphify export obsidian
```

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]
- [[architecture/output-media-selection|Output Media Selection Rules]]
- [[00 - Index|Vault Index]]
