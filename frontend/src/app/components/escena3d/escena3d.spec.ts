import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopographyScene } from './escena3d';

describe('TopographyScene', () => {
  let component: TopographyScene;
  let fixture: ComponentFixture<TopographyScene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopographyScene],
    }).compileComponents();

    fixture = TestBed.createComponent(TopographyScene);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
