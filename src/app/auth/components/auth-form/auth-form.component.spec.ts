import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';

import { componentTestImports } from 'src/testing';
import { AuthFormComponent } from './auth-form.component';

describe('AuthFormComponent', () => {
  let component: AuthFormComponent;
  let fixture: ComponentFixture<AuthFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports(), ReactiveFormsModule],
      declarations: [AuthFormComponent],
      // The template is Material-heavy; this spec is about the form logic, not the chrome.
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts with empty username and password controls', () => {
    expect(component.form.value).toEqual({ username: '', password: '' });
  });

  it('emits the entered credentials on submit', () => {
    const emitted: any[] = [];
    component.submitEmitter.subscribe(value => emitted.push(value));
    component.form.setValue({ username: 'curator', password: 'secret' });

    component.submit();

    expect(emitted).toEqual([{ username: 'curator', password: 'secret' }]);
  });

  it('ignores a second submit while a request is still in flight', () => {
    // Without this guard each click fired another concurrent login + bootstrap sequence.
    const emitted: any[] = [];
    component.submitEmitter.subscribe(value => emitted.push(value));
    component.form.setValue({ username: 'curator', password: 'secret' });

    component.submit();
    component.loading = true;
    component.submit();

    expect(emitted.length).toEqual(1);
  });

  it('resumes emitting once the request finishes', () => {
    const emitted: any[] = [];
    component.submitEmitter.subscribe(value => emitted.push(value));

    component.loading = true;
    component.submit();
    component.loading = false;
    component.submit();

    expect(emitted.length).toEqual(1);
  });

  it('submits when the form is submitted from the template', () => {
    spyOn(component, 'submit');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', {});

    expect(component.submit).toHaveBeenCalled();
  });

  it('defaults the title to Login and shows the provided one', () => {
    expect(component.title).toEqual('Login');

    component.title = 'Register';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Register');
  });

  it('shows the error message only when one is set', () => {
    expect(fixture.debugElement.query(By.css('.error'))).toBeNull();

    component.error = 'Wrong user name or password';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.error')).nativeElement.textContent)
      .toContain('Wrong user name or password');
  });

  it('disables the button and labels it as signing in while loading', () => {
    const button = () => fixture.debugElement.query(By.css('button')).nativeElement;
    expect(button().disabled).toBeFalse();
    expect(button().textContent).toContain('OK');

    component.loading = true;
    fixture.detectChanges();

    expect(button().disabled).toBeTrue();
    expect(button().textContent).toContain('Signing in');
  });
});
