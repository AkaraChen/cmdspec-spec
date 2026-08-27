export type Node =
  | Program
  | Comment
  | ArgStatement
  | Assignment
  | EnvStatement
  | RunStatement
  | PipeBlock
  | IfBlock
  | ForBlock
  | WhileBlock
  | TryBlock
  | FnBlock
  | AsyncBlock
  | AssertStatement
  | WaitStatement
  | AbortStatement
  | ReturnStatement;

export interface Position {
  line: number;
  column: number;
}

export interface Program {
  type: "Program";
  body: Node[];
  pos: Position;
}

export interface Comment {
  type: "Comment";
  text: string;
  pos: Position;
}

export type ArgType = "string" | "number" | "boolean" | "string[]" | "number[]";

export interface ArgStatement {
  type: "ArgStatement";
  name: string;
  argType: ArgType;
  optional: boolean;
  defaultValue: string | null;
  pos: Position;
}

export interface Assignment {
  type: "Assignment";
  name: string;
  value: string;
  pos: Position;
}

export interface EnvStatement {
  type: "EnvStatement";
  name: string;
  op: "=" | "+=";
  value: string;
  pos: Position;
}

export interface RunStatement {
  type: "RunStatement";
  tolerant: boolean;
  command: string;
  redirect: string | null;
  pos: Position;
}

export interface PipeBlock {
  type: "PipeBlock";
  commands: string[];
  redirect: string | null;
  pos: Position;
}

export interface IfBlock {
  type: "IfBlock";
  condition: string;
  body: Node[];
  elifs: { condition: string; body: Node[] }[];
  elseBody: Node[] | null;
  pos: Position;
}

export interface ForBlock {
  type: "ForBlock";
  variable: string;
  iterable: string;
  body: Node[];
  pos: Position;
}

export interface WhileBlock {
  type: "WhileBlock";
  condition: string;
  body: Node[];
  pos: Position;
}

export interface TryBlock {
  type: "TryBlock";
  body: Node[];
  onFail: Node[];
  pos: Position;
}

export interface FnBlock {
  type: "FnBlock";
  name: string;
  args: ArgStatement[];
  body: Node[];
  pos: Position;
}

export interface AsyncBlock {
  type: "AsyncBlock";
  body: Node[];
  pos: Position;
}

export interface AssertStatement {
  type: "AssertStatement";
  expr: string;
  predicate: string;
  argument: string | null;
  message: string | null;
  pos: Position;
}

export interface WaitStatement {
  type: "WaitStatement";
  duration: string;
  pos: Position;
}

export interface AbortStatement {
  type: "AbortStatement";
  message: string;
  pos: Position;
}

export interface ReturnStatement {
  type: "ReturnStatement";
  value: string | null;
  pos: Position;
}
