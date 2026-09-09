import { FRAMEWORK_CLASSES } from './framework-contract.mjs';

const wrapperTypes = new Set([
  'ChainExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

function unwrap(node) {
  while (node && wrapperTypes.has(node.type)) {
    node = node.expression;
  }
  return node;
}

export function walk(sourceCode, root, visitor) {
  const visit = node => {
    visitor(node);
    for (const key of sourceCode.visitorKeys[node.type] || []) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child => child && visit(child));
      } else if (value) {
        visit(value);
      }
    }
  };
  visit(root);
}

function variableForIdentifier(sourceCode, node) {
  if (node?.type !== 'Identifier') {
    return;
  }

  let scope = sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      return variable;
    }
    scope = scope.upper;
  }
}

function declaredVariable(sourceCode, node, name) {
  return sourceCode.getDeclaredVariables(node).find(variable => !name || variable.name === name);
}

function hasReassignment(variable) {
  if (!variable) {
    return true;
  }
  const definition = variable.defs[0];
  if (definition?.type === 'Variable' && definition.parent.kind !== 'const') {
    return true;
  }
  return variable.references.some(reference => reference.isWrite() && !reference.init);
}

export function createMarionetteAnalysis(sourceCode) {
  const importedClasses = new Map();
  const importedNamespaces = new Set();
  const definitions = [];
  const definitionByNode = new Map();
  const definitionByVariable = new Map();
  const instanceByVariable = new Map();
  const aliases = [];
  const instances = [];

  for (const statement of sourceCode.ast.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'marionette') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      const variable = declaredVariable(sourceCode, specifier, specifier.local.name);
      if (!variable) {
        continue;
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        importedNamespaces.add(variable);
      } else if (specifier.type === 'ImportSpecifier' && FRAMEWORK_CLASSES.has(specifier.imported.name)) {
        importedClasses.set(variable, specifier.imported.name);
      }
    }
  }

  walk(sourceCode, sourceCode.ast, node => {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      definitions.push({ kind: 'class', node, baseExpression: node.superClass });
      return;
    }

    if (node.type === 'CallExpression') {
      const callee = unwrap(node.callee);
      if (callee?.type === 'MemberExpression' && !callee.computed && callee.property.name === 'extend') {
        definitions.push({ kind: 'extend', node, baseExpression: callee.object,
          members: unwrap(node.arguments[0]) });
      }
      return;
    }

    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const variable = declaredVariable(sourceCode, node, node.id.name);
      if (!variable) {
        return;
      }
      aliases.push({ expression: unwrap(node.init), variable });
      if (unwrap(node.init)?.type === 'NewExpression') {
        instances.push({ expression: unwrap(node.init).callee, variable });
      }
    }
  });

  function importedType(expression) {
    expression = unwrap(expression);
    if (expression?.type === 'Identifier') {
      return importedClasses.get(variableForIdentifier(sourceCode, expression));
    }
    if (expression?.type !== 'MemberExpression' || expression.computed || expression.property.type !== 'Identifier') {
      return;
    }
    const object = unwrap(expression.object);
    if (object?.type === 'Identifier' && importedNamespaces.has(variableForIdentifier(sourceCode, object)) &&
      FRAMEWORK_CLASSES.has(expression.property.name)) {
      return expression.property.name;
    }
  }

  function definitionForExpression(expression) {
    expression = unwrap(expression);
    const type = importedType(expression);
    if (type) {
      return { frameworkRoot: true, type };
    }
    if (expression?.type === 'Identifier') {
      return definitionByVariable.get(variableForIdentifier(sourceCode, expression));
    }
    return definitionByNode.get(expression);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of definitions) {
      if (definitionByNode.has(definition.node)) {
        continue;
      }
      const base = definitionForExpression(definition.baseExpression);
      if (!base) {
        continue;
      }
      const descriptor = { ...definition, base, type: base.type };
      definitionByNode.set(definition.node, descriptor);

      const declaration = definition.kind === 'class' ? definition.node : definition.node.parent;
      const variable = definition.kind === 'class' ?
        declaredVariable(sourceCode, definition.node, definition.node.id?.name) :
        declaration?.type === 'VariableDeclarator' ? declaredVariable(sourceCode, declaration, declaration.id.name) : undefined;
      if (variable && !hasReassignment(variable)) {
        definitionByVariable.set(variable, descriptor);
      }
      changed = true;
    }

    for (const { expression, variable } of aliases) {
      if (definitionByVariable.has(variable) || instanceByVariable.has(variable) || hasReassignment(variable)) {
        continue;
      }
      const descriptor = definitionForExpression(expression);
      if (descriptor) {
        definitionByVariable.set(variable, descriptor);
        changed = true;
      }
    }

    for (const { expression, variable } of instances) {
      if (instanceByVariable.has(variable) || hasReassignment(variable)) {
        continue;
      }
      const descriptor = definitionForExpression(expression);
      if (descriptor) {
        instanceByVariable.set(variable, descriptor);
        changed = true;
      }
    }
  }

  function enclosingDefinition(node) {
    for (let current = node.parent; current; current = current.parent) {
      if (current.type === 'StaticBlock' ||
          ((current.type === 'MethodDefinition' || current.type === 'PropertyDefinition') && current.static)) {
        return;
      }
      if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
        return definitionByNode.get(current);
      }
      if (['FunctionDeclaration', 'FunctionExpression'].includes(current.type)) {
        const property = current.parent;
        if ((property.type === 'MethodDefinition' || property.type === 'PropertyDefinition') && property.static) {
          return;
        }
        const descriptor = property?.parent && definitionByNode.get(property.parent.parent || property.parent);
        if (property.value === current && (descriptor?.members === property.parent ||
          (descriptor?.kind === 'class' && property.parent.type === 'ClassBody'))) {
          return descriptor;
        }
        return;
      }
    }
  }

  function receiverDefinition(expression) {
    expression = unwrap(expression);
    if (expression?.type === 'ThisExpression') {
      return enclosingDefinition(expression);
    }
    if (expression?.type === 'Super') {
      return enclosingDefinition(expression)?.base;
    }
    if (expression?.type === 'Identifier') {
      return instanceByVariable.get(variableForIdentifier(sourceCode, expression));
    }
    if (expression?.type === 'NewExpression') {
      return definitionForExpression(expression.callee);
    }
  }

  return { receiverDefinition };
}
