import {
  parseSeededProblems,
  type SeededProblemDefinition,
} from "./problem-seed.schema.js";

export const seededProblems = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    ownerId: null,
    visibility: "seeded",
    title: "Two Sum",
    slug: "two-sum",
    descriptionMarkdown:
      "Given an array of integers `nums` and an integer `target`, return the indexes of the two numbers whose sum equals `target`. Assume exactly one valid answer exists, and do not use the same element twice.",
    difficulty: "easy",
    tags: ["arrays", "hash map"],
    constraintsMarkdown:
      "- `2 <= nums.length <= 10,000`\n- `-1,000,000,000 <= nums[i], target <= 1,000,000,000`\n- Exactly one valid answer exists.",
    examples: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
        explanation: "The values at indexes 0 and 1 add up to 9.",
      },
      {
        input: "nums = [3, 2, 4], target = 6",
        output: "[1, 2]",
        explanation: "The values at indexes 1 and 2 add up to 6.",
      },
    ],
    interviewerNotesMarkdown:
      "Look for a one-pass hash-map solution and a clear explanation of the time-space tradeoff.",
    starterCode: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        language: "typescript",
        code: `export function twoSum(nums: number[], target: number): number[] {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        language: "javascript",
        code: `export function twoSum(nums, target) {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        language: "python",
        code: `def two_sum(nums: list[int], target: int) -> list[int]:
    raise NotImplementedError`,
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    ownerId: null,
    visibility: "seeded",
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    descriptionMarkdown:
      "Given a string containing only `(`, `)`, `{`, `}`, `[` and `]`, determine whether it is valid. Every opening bracket must be closed by the same type of bracket and in the correct order.",
    difficulty: "easy",
    tags: ["strings", "stack"],
    constraintsMarkdown:
      "- `1 <= s.length <= 10,000`\n- `s` contains parentheses characters only.",
    examples: [
      {
        input: 's = "()[]{}"',
        output: "true",
        explanation: "Each opening bracket is closed in the correct order.",
      },
      {
        input: 's = "([)]"',
        output: "false",
        explanation: "The square bracket is closed after the parenthesis.",
      },
    ],
    interviewerNotesMarkdown:
      "Ask the candidate to explain why a stack models nested brackets and how unmatched closing brackets are handled.",
    starterCode: [
      {
        id: "20000000-0000-4000-8000-000000000004",
        language: "typescript",
        code: `export function isValidParentheses(input: string): boolean {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000005",
        language: "javascript",
        code: `export function isValidParentheses(input) {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000006",
        language: "python",
        code: `def is_valid_parentheses(value: str) -> bool:
    raise NotImplementedError`,
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    ownerId: null,
    visibility: "seeded",
    title: "Binary Tree Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    descriptionMarkdown:
      "Given the root of a binary tree, return its node values level by level from left to right. Return an empty list when the root is null.",
    difficulty: "medium",
    tags: ["trees", "breadth-first search", "queue"],
    constraintsMarkdown:
      "- The tree contains between `0` and `2,000` nodes.\n- `-1,000 <= node.value <= 1,000`.",
    examples: [
      {
        input: "root = [3, 9, 20, null, null, 15, 7]",
        output: "[[3], [9, 20], [15, 7]]",
        explanation:
          "Each nested list contains the values from one tree level.",
      },
      {
        input: "root = []",
        output: "[]",
        explanation: "An empty tree has no levels.",
      },
    ],
    interviewerNotesMarkdown:
      "Look for breadth-first traversal with a queue and explicit tracking of each level's size.",
    starterCode: [
      {
        id: "20000000-0000-4000-8000-000000000007",
        language: "typescript",
        code: `export type TreeNode = {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
};

export function levelOrder(root: TreeNode | null): number[][] {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000008",
        language: "javascript",
        code: `export function levelOrder(root) {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000009",
        language: "python",
        code: `from dataclasses import dataclass


@dataclass
class TreeNode:
    value: int
    left: "TreeNode | None" = None
    right: "TreeNode | None" = None


def level_order(root: TreeNode | None) -> list[list[int]]:
    raise NotImplementedError`,
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    ownerId: null,
    visibility: "seeded",
    title: "Coin Change",
    slug: "coin-change",
    descriptionMarkdown:
      "Given coin denominations and a target amount, return the fewest coins needed to make that amount. Return `-1` when the amount cannot be formed. Each denomination may be used any number of times.",
    difficulty: "medium",
    tags: ["dynamic programming", "arrays"],
    constraintsMarkdown:
      "- `1 <= coins.length <= 20`\n- `1 <= coins[i] <= 10,000`\n- `0 <= amount <= 10,000`.",
    examples: [
      {
        input: "coins = [1, 2, 5], amount = 11",
        output: "3",
        explanation: "The amount can be formed with 5 + 5 + 1.",
      },
      {
        input: "coins = [2], amount = 3",
        output: "-1",
        explanation: "No combination of the available coins forms 3.",
      },
    ],
    interviewerNotesMarkdown:
      "Ask for the recurrence, base case, impossible-state representation, and resulting time and space complexity.",
    starterCode: [
      {
        id: "20000000-0000-4000-8000-000000000010",
        language: "typescript",
        code: `export function coinChange(coins: number[], amount: number): number {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000011",
        language: "javascript",
        code: `export function coinChange(coins, amount) {
  throw new Error("Not implemented");
}`,
      },
      {
        id: "20000000-0000-4000-8000-000000000012",
        language: "python",
        code: `def coin_change(coins: list[int], amount: int) -> int:
    raise NotImplementedError`,
      },
    ],
  },
] as const satisfies readonly SeededProblemDefinition[];

export const validatedSeededProblems = parseSeededProblems(seededProblems);
