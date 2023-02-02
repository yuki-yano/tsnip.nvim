type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends ((k: infer I) => void)
    ? I
    : never;

type UnionInput<T> = T extends ReadonlyArray<infer U>
  ? U extends SingleLineInput<infer K> | MultiLineInput<infer K> ? {
      [key in K]: U extends SingleLineInput<string> ? { text: string }
        : U extends MultiLineInput<string> ? { text: Array<string> }
        : never;
    }
  : never
  : never;

export type Params = ReadonlyArray<
  SingleLineInput<string> | MultiLineInput<string>
>;
export type SingleLineInput<K extends string> = {
  readonly name: K;
  readonly type: "single_line";
};
export type MultiLineInput<K extends string> = {
  readonly name: K;
  readonly type: "multi_line";
};
export type Inputs<T = Params> = UnionToIntersection<UnionInput<T>>;

export type Context = {
  fileName: { text: string };
  fileType: { text: string };
  cwd: { text: string };
  postCursor: string;
};

export type Snippet<T extends Params = Params> = {
  name?: string;
  text?: string;
  params: T;
  render: (inputs: Inputs<T>, extraInputs: Context) => string;
};
