import { describe, expect, it } from 'vitest';
import { markSpecies } from '@/lib/text/species-marker';
import { stripEmphasis } from '@/lib/text/emphasis';

describe('species marker', () => {
  it('marks single-kind animals, lower case included', () => {
    expect(markSpecies('Elephants, lions and leopards gather at the river.')).toBe('**Elephants**, **lions** and **leopards** gather at the river.');
  });
  it('does not mark groups', () => {
    const t = 'Monkeys, antelope, big cats and predators are common, with raptors overhead.';
    expect(markSpecies(t)).toBe(t);
  });
  it('marks gated nouns only with a name part', () => {
    expect(markSpecies('Look for proboscis monkeys and other monkeys.')).toBe('Look for **proboscis monkeys** and other monkeys.');
    expect(markSpecies("Grant's gazelle and the roan antelope.")).toBe("**Grant's gazelle** and the **roan antelope**.");
  });
  it('takes the whole name including capitalised parts and merges neighbours', () => {
    expect(markSpecies("African wild dogs and Thornicroft's giraffe, plus gharial crocodiles.")).toBe("**African wild dogs** and **Thornicroft's giraffe**, plus **gharial crocodiles**.");
  });
  it('never treats a place possessive as part of the name', () => {
    expect(markSpecies("Uganda's elephants roam.", { placeWords: new Set(['uganda']) })).toBe("Uganda's **elephants** roam.");
  });
  it('skips compounds that are not the animal', () => {
    const x = 'The elephant grass dries out.';
    expect(markSpecies(x)).toBe(x);
  });
  it('marks each animal once per blurb, whatever name it appears under', () => {
    expect(markSpecies('Greater one-horned rhinos are guaranteed, and the park holds over 100 rhinos.')).toBe('**Greater one-horned rhinos** are guaranteed, and the park holds over 100 rhinos.');
    expect(markSpecies('Elephants graze, and Asian elephants drink; water buffalo and buffalo wade.')).toBe('**Elephants** graze, and Asian elephants drink; **water buffalo** and buffalo wade.');
  });
  it('treats different kinds of the same animal as different', () => {
    expect(markSpecies('Black rhinos and white rhinos both live here.')).toBe('**Black rhinos** and **white rhinos** both live here.');
  });
  it('handles whales and dolphins: named kinds count, bare groups do not', () => {
    expect(markSpecies('Humpback whales and bottlenose dolphins are seen, while other whales and dolphins pass by.')).toBe('**Humpback whales** and **bottlenose dolphins** are seen, while other whales and dolphins pass by.');
    expect(markSpecies('Belugas gather here, and beluga whales stay all summer.')).toBe('**Belugas** gather here, and beluga whales stay all summer.');
    expect(markSpecies("Bryde's whales and orcas are rare.")).toBe("**Bryde's whales** and **orcas** are rare.");
  });
  it('marks every name in a list that ends in whales, and not "harbor whale watching"', () => {
    expect(markSpecies('It draws beluga, minke, fin, and blue whales each summer.')).toBe('It draws **beluga**, **minke**, **fin**, and **blue whales** each summer.');
    expect(markSpecies('Harbor whale watching trips run daily, and harbor porpoises follow.')).toBe('Harbor whale watching trips run daily, and **harbor porpoises** follow.');
  });
  it('marks possessive names in a whale list', () => {
    expect(markSpecies("Resident dusky, Heaviside's, and common dolphins are seen.")).toBe("Resident **dusky**, **Heaviside's**, and **common dolphins** are seen.");
  });
  it('is idempotent and never changes the words', () => {
    const t = 'Greater one-horned rhinos and water buffalo graze near Bengal tigers.';
    const once = markSpecies(t);
    expect(markSpecies(once)).toBe(once);
    expect(stripEmphasis(once)).toBe(t);
  });
});
