export function showEffortForModel(model: string): boolean {
  const name = model.trim().toLowerCase().split('/').at(-1) ?? ''
  return /^gpt(?:[-._]|$)/.test(name) || /^o(?:1|3|4)(?:[-._]|$)/.test(name)
}
