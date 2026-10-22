import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Escena3d } from './escena3d';

describe('Escena3d', () => {
  let component: Escena3d;
  let fixture: ComponentFixture<Escena3d>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Escena3d],
    }).compileComponents();

    fixture = TestBed.createComponent(Escena3d);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
