import { createMarionetteAnalysis, walk } from '../tools/eslint/analysis.mjs';
import { PRIVATE_MEMBERS } from '../tools/eslint/framework-contract.mjs';

export default {
  meta: {
    type: 'problem',
    diagnosticCode: 'MN0040',
    docs: {
      description: 'Disallow access to known private members on proven Marionette instances.',
      recommended: true,
    },
    messages: {
      privateMember: '{{type}}.{{name}} is a private framework member.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode;
    return {
      'Program:exit'(program) {
        const analysis = createMarionetteAnalysis(sourceCode);
        walk(sourceCode, program, node => {
          if (node.type !== 'MemberExpression' || node.computed) {
            return;
          }
          const name = node.property.type === 'Identifier' ? node.property.name : undefined;
          const receiver = analysis.receiverDefinition(node.object);
          if (name && receiver && PRIVATE_MEMBERS[receiver.type]?.has(name)) {
            context.report({ node: node.property, messageId: 'privateMember', data: { name, type: receiver.type } });
          }
        });
      },
    };
  },
};
