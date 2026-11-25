const colours: Record<string, string> = {
  "E2-A": "var(--chart-5)", "E2-B": "var(--chart-3)", "E2-C": "var(--chart-4)", "E2-D": "var(--chart-1)",
  "E5-A": "var(--model-slate)", "E5-B": "var(--chart-2)", "E5-C": "var(--model-ocean)",
  B1: "var(--model-violet)", B2: "var(--model-olive)", B3: "var(--model-brown)", B4: "var(--model-stone)", B5: "var(--model-rose)",
};

export const modelColour = (id: string) => colours[id] ?? "var(--primary)";
