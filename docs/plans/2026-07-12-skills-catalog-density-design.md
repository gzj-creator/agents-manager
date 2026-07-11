# Skills Catalog Density Design

## Goal

Make the skill list the visual focus of the Skills page by reducing the height of the catalog controls above it.

## Layout

- Keep the Warehouse heading and the create/refresh actions on the first row.
- Place search, tag filtering, and the warehouse import toggle on a compact second row.
- Render expanded import controls below the compact toolbar so they remain fully accessible.
- Keep the skill count immediately above the list.
- Let the skill list consume all remaining catalog height and scroll independently.

## Responsive Behavior

The compact second row uses a three-column grid on desktop. At narrower widths it returns to a vertical layout so inputs and actions remain readable.

## Verification

- Rendered Skills HTML contains the compact toolbar structure.
- Existing Skills interactions and element IDs remain unchanged.
- Desktop tests and the Vite build pass.

