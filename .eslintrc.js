module.exports = {
  extends: [
    'airbnb-typescript/base',
  ],
  env: {
    browser: true,
    commonjs: true,
    es2020: true,
  },
  plugins: [
    'babel',
    'import',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 12,
    project: './tsconfig.eslint.json',
  },
  rules: {
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    semi: ['warn', 'always'],
    'no-console': 'off',
    'no-unused-vars': 'warn',
    'no-inner-declarations': 'warn',
    'no-useless-escape': 'warn',
    'no-debugger': 'warn',

    /*
     * New Rules
     */


    // require assignment operator shorthand where possible or prohibit it entirely
    'operator-assignment': 'off',

    // require parens in arrow function arguments
    'arrow-parens': ['error', 'as-needed'],

    // disallow certain syntax forms
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],

    // disallow use of the continue statement
    'no-continue': 'off',

    // enforce that class methods use "this"
    'class-method-use-this': 'off',

    // disallow padding within blocks
    'padded-blocks': ['error', {
      blocks: 'never',
      classes: 'always',
      switches: 'never',
    }, {
      allowSingleLineBlocks: true,
    }],

    // enforces no braces where they can be omitted
    'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: true }],

    // specify the maximum length of a line in your program
    'max-len': ['warn', 100, 2, {
      ignoreUrls: true,
      ignoreComments: false,
      ignoreRegExpLiterals: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
    }],

    // disallow use of unary operators, ++ and --
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],

    // disallow unnecessary constructor
    'no-useless-constructor': 'off',

    // disallow empty functions, except for standalone funcs/arrows
    'no-empty-function': ['error', {
      allow: [
        'arrowFunctions',
        'functions',
        'methods',
        'constructors',
      ],
    }],

    // require or disallow an empty line between class members
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],

    // disallow multiple empty lines, only one newline at the end, and no new lines at the beginning
    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 2, maxEOF: 0 }],

    // require or disallow Yoda conditions
    yoda: ['error', 'never', { exceptRange: true }],

    // disallow dangling underscores in identifiers
    'no-underscore-dangle': 'off',

    // enforce that class methods use "this"
    'class-methods-use-this': 'off',

    // Disallow await inside of loops
    'no-await-in-loop': 'off',

    // enforce line breaks between braces
    'object-curly-newline': ['off', {
      ObjectExpression: { minProperties: 4, multiline: true, consistent: true },
      ObjectPattern: { minProperties: 4, multiline: true, consistent: true },
      ImportDeclaration: { minProperties: 4, multiline: true, consistent: true },
      ExportDeclaration: { minProperties: 4, multiline: true, consistent: true },
    }],


    // Ensure consistent use of file extension within the import path
    'import/extensions': ['error', 'ignorePackages', { '': 'never', js: 'never', ts: 'never' }],

    // Require modules with a single export to use a default export
    'import/prefer-default-export': 'off',


    /*
     * Eslint Airbnb Config Rules that We've agreed to adopt.
     * Part 1. Auto Fix Applicable
     */

    // require padding inside curly braces
    'object-curly-spacing': ['error', 'always'],

    // Prefer use of an object spread over Object.assign
    'prefer-object-spread': 'error',

    // enforce newline at the end of file, with no multiple empty lines
    'eol-last': ['error', 'always'],

    // enforces spacing between keys and values in object literal properties
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],

    // this option sets a specific tab width for your code
    indent: ['error', 2, {
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1,
      // MemberExpression: null,
      FunctionDeclaration: {
        parameters: 1,
        body: 1,
      },
      FunctionExpression: {
        parameters: 1,
        body: 1,
      },
      CallExpression: {
        arguments: 1,
      },
      ArrayExpression: 1,
      ObjectExpression: 1,
      ImportDeclaration: 1,
      flatTernaryExpressions: false,
      // list derived from https://github.com/benjamn/ast-types/blob/HEAD/def/jsx.js
      ignoredNodes: ['JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXFragment', 'JSXOpeningFragment', 'JSXClosingFragment', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
      ignoreComments: false,
    }],

    // disallow else after a return in an if
    'no-else-return': ['error', { allowElseIf: false }],

    // enforces spacing between keys and values in object literal properties
    'keyword-spacing': ['error', {
      before: true,
      after: true,
      overrides: {
        return: { after: true },
        throw: { after: true },
        case: { after: true },
      },
    }],

    // require or disallow space before blocks
    'space-before-blocks': 'error',


    // suggest using of const declaration for variables that are never modified after declared
    'prefer-const': ['error', {
      destructuring: 'any',
      ignoreReadBeforeAssign: true,
    }],

    // require let or const instead of var
    'no-var': 'error',

    // disallow use of multiple spaces
    'no-multi-spaces': ['error', {
      ignoreEOLComments: false,
    }],

    // disallow trailing whitespace at the end of lines
    'no-trailing-spaces': ['error', {
      skipBlankLines: false,
      ignoreComments: false,
    }],

    // Prefer destructuring from arrays and objects
    'prefer-destructuring': ['error', {
      VariableDeclarator: {
        array: false,
        object: true,
      },
      AssignmentExpression: {
        array: false,
        object: false,
      },
    }, {
      enforceForRenamedProperties: false,
    }],

    // suggest using template literals instead of string concatenation
    'prefer-template': 'error',

    // require or disallow a space immediately following the // or /* in a comment
    'spaced-comment': ['error', 'always', {
      line: {
        exceptions: ['-', '+'],
        markers: ['=', '!', '/'], // space here to support sprockets directives, slash for TS /// comments
      },
      block: {
        exceptions: ['-', '+'],
        markers: ['=', '!', ':', '::'], // space here to support sprockets directives and flow comment types
        balanced: true,
      },
    }],

    // enforce spacing before and after comma
    'comma-spacing': ['error', { before: false, after: true }],

    // Requires operator at the beginning of the line in multiline statements
    'operator-linebreak': ['error', 'before', { overrides: { '=': 'none' } }],

    // Ensures that there are no useless path segments
    'import/no-useless-path-segments': ['error', { commonjs: true }],


    /*
     * Part 2. Auto Fix Not Applicable
     */


    // disallow declaration of variables already declared in the outer scope
    'no-shadow': 'error',

    // require all requires be top-level
    'global-require': 'error',

    // disallow usage of expressions in statement position
    'no-unused-expressions': 'off',
    'babel/no-unused-expressions': ['error', {
      allowShortCircuit: false,
      allowTernary: false,
      allowTaggedTemplates: false,
    }],

    // disallow use of variables before they are defined
    'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],

    // require function expressions to have a name
    'func-names': 'off',

    // require return statements to either always or never specify values
    'consistent-return': ['error', { treatUndefinedAsUnspecified: true }],

    // require a capital letter for constructors
    'new-cap': ['error', {
      newIsCap: true,
      newIsCapExceptions: [],
      capIsNew: false,
      capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
      newIsCapExceptionPattern: '^ccxt\..',
    }],

    // requires to declare all vars on top of their containing scope
    'vars-on-top': 'error',

    // disallow redundant `return`
    'no-return-await': 'error',

    // require default case in switch statements
    'default-case': ['error', { commentPattern: '^no default$' }],

    // require camel case names
    camelcase: 'off',
    'babel/camelcase': ['off', { properties: 'never', ignoreDestructuring: false }],

    // require the use of === and !==
    eqeqeq: ['error', 'always', { null: 'ignore' }],

    // disallow nested ternary expressions
    'no-nested-ternary': 'error',

    // enforce a maximum number of classes per file
    'max-classes-per-file': ['error', 1],

    // Forbid require() calls with expressions
    'import/no-dynamic-require': 'error',


    /*
     * Arguable Part 1, Airbnb Config that we've agreed but didn't know
     * what exactly it is. There's no brand new thing except
     * no-underscore-dangle, allowAfterThis.
     */


    // encourages use of dot notation whenever possible
    'dot-notation': ['error', { allowKeywords: true }],

    // require method and property shorthand syntax for object literals
    'object-shorthand': ['error', 'always', {
      ignoreConstructors: false,
      avoidQuotes: true,
    }],

    // disallow reassignment of function parameters
    // disallow parameter object manipulation except for specific exclusions
    'no-param-reassign': ['warn', {
      props: true,
      ignorePropertyModificationsFor: [
        'acc', // for reduce accumulators
        'accumulator', // for reduce accumulators
        'e', // for e.returnvalue
        'ctx', // for Koa routing
        'context', // for Koa routing
        'req', // for Express requests
        'request', // for Express requests
        'res', // for Express responses
        'response', // for Express responses
        '$scope', // for Angular 1 scopes
        'staticContext', // for ReactRouter context
        'doc',
        'order',
      ],
    }],

    // require trailing commas in multiline object literals
    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'always-multiline',
    }],

    // require quotes around object literal property names
    'quote-props': ['error', 'as-needed', { keywords: false, unnecessary: true, numbers: false }],

    // Forbid cyclical dependencies between modules
    'import/no-cycle': ['warn', { maxDepth: Infinity }],


    /*
     * Arguable Part 2, Sorting import statements.
     */
    'import/order': ['warn', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
      ],
      'newlines-between': 'always',
      alphabetize: { order: 'asc' },
      pathGroups: [
        {
          pattern: 'common/**',
          group: 'internal',
          position: 'after',
        },
        {
          pattern: 'bot/**',
          group: 'internal',
          position: 'after',
        },
        {
          pattern: 'server/**',
          group: 'internal',
          position: 'after',
        },
      ],
    }],
  },
  settings: {
    'import/resolver': {
      node: {
        moduleDirectory: ['node_modules', 'src'],
        extensions: ['.js', '.ts', '.d.ts'],
      },
      typescript: {},
    },
    'import/extensions': ['.js', '.ts', '.d.ts'],
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.js'],
    },
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-unused-vars': 'off',
        'no-useless-constructor': 'off',
        'no-shadow': 'off',
        semi: 'off',
        '@typescript-eslint/semi': ['warn', 'always'],
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-useless-constructor': 'off',
        '@typescript-eslint/type-annotation-spacing': ['error', {
          before: false,
          after: true,
          overrides: {
            arrow: { before: true },
          },
        }],
        '@typescript-eslint/member-delimiter-style': ['warn'],
        '@typescript-eslint/lines-between-class-members': ['off'],
        '@typescript-eslint/naming-convention': ['error',
          {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
          },
          // Allow camelCase functions (23.2), and PascalCase functions (23.8)
          {
            selector: 'function',
            format: ['camelCase', 'PascalCase'],
            leadingUnderscore: 'allow',
          },
          // Airbnb recommends PascalCase for classes (23.3), and although Airbnb does not make TypeScript
          // recommendations, we are assuming this rule would similarly apply to anything "type like", including
          // interfaces, type aliases, and enums
          {
            selector: 'typeLike',
            format: ['PascalCase'],
          }],
        '@typescript-eslint/member-ordering': ['error', {
          classes: {
            memberTypes: [
              // Index signature
              'signature',

              // Fields
              'public-static-field',
              'public-decorated-field',
              'public-instance-field',
              'public-abstract-field',
              'public-field',

              'protected-static-field',
              'protected-decorated-field',
              'protected-instance-field',
              'protected-abstract-field',
              'protected-field',

              'private-static-field',
              'private-decorated-field',
              'private-instance-field',
              'private-abstract-field',
              'private-field',

              'static-field',
              'instance-field',
              'abstract-field',

              'decorated-field',

              'field',

              // Constructors
              'public-constructor',
              'protected-constructor',
              'private-constructor',

              'constructor',

              // Methods
              'public-static-method',
              'public-decorated-method',
              'public-instance-method',
              'public-abstract-method',
              'public-method',

              'protected-static-method',
              'protected-decorated-method',
              'protected-instance-method',
              'protected-abstract-method',
              'protected-method',

              'private-static-method',
              'private-decorated-method',
              'private-instance-method',
              'private-abstract-method',
              'private-method',

              'static-method',
              'instance-method',
              'abstract-method',

              'decorated-method',

              'method',
            ],
            order: 'as-written',
          },
        }],
      },
    },
    {
      files: ['*.test.ts', '*.test.js'],
      env: {
        jest: true,
      },
    },
    {
      files: ['*.config.ts', '*.config.js'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        'import/no-dynamic-require': 'off',
      },
    },
    {
      files: ['**/tests/**/*'],
      rules: {
        'max-classes-per-file': 'off',
      },
    },
  ],
};
