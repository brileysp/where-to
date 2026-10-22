# Species names

Rules the live texts follow (owner decisions, Oct 2026):

- **Birds** are written with their full eBird name in Title Case ("Gray Heron", "Atlantic Puffin"). The eBird list is https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=csv&cat=species (works without a key). Check a name against it before using it.
- **Every other animal** is lowercase except proper nouns and adjectives ("gray seal", "southern right whale").
- **American spelling** throughout ("gray", never "grey"), known truth T05.
- Names swept out on 22 Oct 2026 must not come back: `src/lib/text/retired-bird-names.ts`, known truth T06. If a new text trips it, use the name it suggests.

## Decided 22 Oct 2026 (the bird name sweep; script `scripts/fix-bird-names-oct22.ts`, 448 changes in 83 places)

Applied: "grey" to "gray" (214 spots), about 45 same-bird renames to the eBird name, split species by place (Northern Goshawk is Eurasian in Berlin and American in the Upper Peninsula; European nutcrackers are Northern Nutcracker; Falklands rockhoppers are Western; Canary Islands houbara is African, Uzbekistan's is Asian; Maldives sand plover is Siberian), and the owner's calls: Bewick's Swan to Tundra Swan, Eurasian Teal to Green-winged Teal, Steppe Buzzard to Common Buzzard, Siberian Tit to Gray-headed Chickadee, Güldenstädt's to White-winged Redstart, Little Auk to Dovekie, guillemots to murres, Brent geese to Brant, Corncrake to Corn Crake, Fea's Petrel to Desertas Petrel (Madeira).

Deliberately kept (names travelers know better than eBird's, or earlier decisions): Wandering Albatross, Nene, Japanese Tit, Cape Petrel, Spanish Imperial Eagle, the accents in Galápagos and Adélie, the "Parrot" names (Puerto Rican, Hispaniolan, Burrowing, Jamaican Black-billed, Eclectus), White-winged Junco, subspecies names that add color (Faroese Starling, Mexican Spotted Owl, Sicilian Rock Partridge, Yellow-billed Kite).

Left open: the white terns (Bora Bora, Maldives) and the Citrine White-eye in Palau (eBird splits them by ocean and the texts do not say which applies); lowercase "honey buzzards" in Sicily and Andalucía (wording question); the headline-bird lists in the birding facts still hold some older names (they are data notes, not shown as text).
