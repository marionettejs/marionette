import { mount, FormKitView, FormKitApplication } from '@mnjs/formkit';
import type { FieldSpec, ComponentFactoryContext } from '@mnjs/formkit';
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;
interface Values { title: string; subscribed: boolean }
const form = mount<Values>({host: document.createElement('div'),fields:[{name:'title'}],values:{title:'a'}});
type ValueNotAny = AssertFalse<IsAny<ReturnType<typeof form.getValues>>>;
type NodeNotAny = AssertFalse<IsAny<typeof form.node>>;
type StateNotAny = AssertFalse<IsAny<ReturnType<typeof form.getFormState>>>;
type FactoryPropsNotAny = AssertFalse<IsAny<ComponentFactoryContext['props']>>;
const title: string = form.getValues().title;
// @ts-expect-error Values retain declared primitive types.
const invalid: number = form.getValues().title;
// @ts-expect-error Partial updates do not accept undeclared properties.
form.setValues({ unknownField: true });
// @ts-expect-error Native field labels retain a string contract.
const badField: FieldSpec = { label: 44 };
// @ts-expect-error Invalid lifecycle methods are not accidental any.
form.nonexistentOperation();
const view = new FormKitView<Values>({ values:{title:'a'} });
// @ts-expect-error Generic constructor retains typed values.
view.setValues({title:false});
const app = new FormKitApplication();
// @ts-expect-error Public application view is not an untyped object.
app.getView()?.nonexistentOperation();
void [title,invalid,badField];
