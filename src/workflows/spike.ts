export async function spikeWorkflow(input: string) {
  "use workflow";
  const fetched = await fetchStep();
  const combined = await combineStep(input, fetched);
  return combined;
}

async function fetchStep() {
  "use step";
  const res = await fetch("https://ai-gateway.vercel.sh/v1/models");
  return { status: res.status };
}

async function combineStep(input: string, fetched: { status: number }) {
  "use step";
  return `${input}:fetch=${fetched.status}`;
}
