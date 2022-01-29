export type Param = {
  name: string;
  type: "single_line";
} | {
  name: string;
  type: "multi_line";
};

export type Inputs = {
  [key: string]: { text: string | undefined } | undefined;
};

export type ExtraInputs = {
  fileName: { text: string };
  fileType: { text: string };
  cwd: { text: string };
};

export type Snippet = {
  name?: string;
  text?: string;
  params: Array<Param>;
  render: (inputs: Inputs, extraInputs: ExtraInputs) => string;
};
