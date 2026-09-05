import type {
  FindVisibleProblemByIdInput,
  FindVisibleProblemByIdResult,
  SearchVisibleProblemsInput,
  SearchVisibleProblemsResult,
} from "@syncslate/database";

export type SearchVisibleProblemsRepository = (
  input: SearchVisibleProblemsInput,
) => Promise<SearchVisibleProblemsResult>;

export type FindVisibleProblemByIdRepository = (
  input: FindVisibleProblemByIdInput,
) => Promise<FindVisibleProblemByIdResult>;

export type ProblemRepositoryDependencies = {
  searchVisibleProblems: SearchVisibleProblemsRepository;
  findVisibleProblemById: FindVisibleProblemByIdRepository;
};
