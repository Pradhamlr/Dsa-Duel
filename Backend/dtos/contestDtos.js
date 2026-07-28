const isNonNegativeInt = (value) => Number.isInteger(value) && value >= 0;

export const createContestDto = {
  numProblems: {
    type: 'number',
    required: false,
    default: 5,
    label: 'Problem count',
    validate: (value) => [3, 4, 5].includes(Number(value)) || 'Problem count must be 3, 4, or 5'
  },
  difficulty: {
    type: 'string',
    required: false,
    default: 'Mixed',
    label: 'Difficulty',
    validate: (value) => ['Easy', 'Medium', 'Mixed'].includes(value) || 'Difficulty must be Easy, Medium, or Mixed'
  },
  duration: {
    type: 'number',
    required: false,
    label: 'Duration',
    validate: (value) => (Number.isFinite(value) && value > 0) || 'Duration must be a positive number'
  },
  selectedTopics: {
    required: false,
    default: [],
    label: 'Selected topics',
    validate: (value) => (Array.isArray(value) && value.every((v) => typeof v === 'string')) || 'Selected topics must be a list of strings'
  }
};

export const startContestDto = {
  duration: {
    type: 'number',
    required: false,
    label: 'Duration',
    validate: (value) => (Number.isFinite(value) && value > 0) || 'Duration must be a positive number'
  }
};

export const markProblemDto = {
  problemIndex: {
    type: 'number',
    required: true,
    label: 'Problem index',
    validate: (value) => isNonNegativeInt(value) || 'Problem index must be a non-negative integer'
  },
  solved: {
    type: 'boolean',
    required: false,
    default: false,
    label: 'Solved'
  }
};

export const problemIndexDto = {
  problemIndex: {
    type: 'number',
    required: true,
    label: 'Problem index',
    validate: (value) => isNonNegativeInt(value) || 'Problem index must be a non-negative integer'
  }
};

export const runSubmitDto = {
  problemIndex: {
    type: 'number',
    required: true,
    label: 'Problem index',
    validate: (value) => isNonNegativeInt(value) || 'Problem index must be a non-negative integer'
  },
  language: {
    type: 'string',
    required: true,
    label: 'Language',
    validate: (value) => ['java', 'cpp'].includes(value) || 'Language must be java or cpp'
  },
  code: {
    type: 'string',
    required: true,
    label: 'Code',
    validate: (value) => value.length <= 50000 || 'Code is too long'
  }
};
