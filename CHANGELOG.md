# Changelog

User-visible changes to the curator tool front end, newest first. Each release names the curator-tool-llm (Paper2Path
service) version it needs, so the two can be deployed together.

## 2026-11-15 — Paper2Path: reactions, entities and issues in one place

Needs curator-tool-llm `9588244` or later (`GET /sessions/{id}/entities`; compartments placed from the paper). Deploy
the service first, then the front end.

### Annotation workspace

- **Tabs are now Reactions · Entities · General issues · Network · Usage.** The separate Issues and Suggested fixes
  tabs are gone; their work moved to where it belongs:
  - **Reaction panel**, in this order: QA summary; *Keep this reaction?* (Remove / Keep, for reactions that may not
    belong); existing-reaction matches; **As Reactome instances**; **About its entities**; other suggested fixes;
    **Issues**; **Notes**; Evidence.
  - Each issue has Resolve / Dismiss (or Reopen), and the suggested fix that settles it right under it, to accept or
    reject. Issues that only matter if the reaction is kept are shown dimmed.
  - **About its entities** lists the reaction's entities with their role, compartment and any existing Reactome
    instance, each with its own issues and fixes (for example a compartment suggestion). A name opens the entity in
    the Entities tab.
  - "Check all" (review every reaction again) is now at the top of the reaction list.
- **Entities tab** (new): every entity of the annotation, with a filter (name, UniProt, compartment) and sorting. For
  each: As Reactome instances, its compartment with how it was found and the paper's passage, components / members /
  part of, the reactions using it (with roles), and its issues and fixes.
- **General issues tab** (new): issues about the annotation as a whole or its papers (no PubMed ID, ...).
- **As Reactome instances** (reaction and entity panels, open by default): what *Load into staged instances* creates,
  in Reactome's data model — class, displayName and every attribute. New instances open inline (Reaction →
  CatalystActivity → EWAS → ModifiedResidue ...); existing Reactome instances show displayName and dbId and open in the
  schema view (new tab).
- Existing Reactome instances used by a reaction or an entity, and existing-reaction matches, show displayName and dbId
  with a link to the schema view.
- **Reaction list**: a bar under each reviewed reaction shows the QA reviewer's confidence (red below 40%, orange below
  70%, green above); new sort "Lowest confidence first". The list is a little wider.
- Accepting a fix, resolving an issue or keeping/removing a reaction in any tab updates every tab.

### Compartments

- Each participant's compartment is shown as a chip: stated by the paper, shown by its experiments, from its parts, set
  by a curator, or *no compartment* (with a suggestion from general knowledge, offered as a fix, never applied).
  Hovering shows the paper's passage.

### PDFs and PubMed IDs

- While the PubMed IDs of chosen PDFs are looked up, a panel covers the *Papers to annotate* card, so an annotation does
  not start without them; *Stop waiting* gives up and lets the ID be typed. *Find in PubMed* in an annotation waits the
  same way.
- An uploaded PDF's PubMed ID is found for you (from its DOI or title) and can be set, changed or removed later in the
  annotation's header.

### Smaller fixes

- Deleting an annotation or removing a reaction asks for confirmation without moving anything: Cancel appears exactly
  where the button was, so a click without moving the mouse (or a double-click) cancels.
- The reaction panel no longer rebuilds itself on every mouse move (it could stop responding with the new sections).
