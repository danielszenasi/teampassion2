import {Component, OnInit, Inject, ViewChild, ElementRef} from '@angular/core';
import {News} from "../models/news.model";
import {FormArray, Validators, FormBuilder, FormGroup} from "@angular/forms";
import {NewsService} from "../services/news.service";
import {FirebaseApp, AngularFire} from "angularfire2";
import * as _ from "lodash";
import {Subject} from "rxjs";

@Component({
  selector: 'app-upload-news',
  templateUrl: './upload-news.component.html',
  styleUrls: ['./upload-news.component.css'],
  providers: [NewsService]
})
export class UploadNewsComponent implements OnInit {

  public myForm: FormGroup;
  private files: Array<File> = [];
  private previewImg: File;
  private mainImg: File;
  private firebaseApp: any;
  private sub: Subject<any> = new Subject();
  private isAuth: boolean = false;

  @ViewChild('images') imageEl: ElementRef;
  @ViewChild('previewImg') previewImgEl: ElementRef;
  @ViewChild('mainImg') mainImgEl: ElementRef;

  constructor(private _fb: FormBuilder,
              private newsService: NewsService,
              @Inject(FirebaseApp) firebaseApp: firebase.app.App,
              public af: AngularFire) {
    this.firebaseApp = firebaseApp;
  }

  ngOnInit() {
    this.sub.subscribe((form) => {
      this.upload(form);
    })
    this.af.auth.subscribe(auth => {
      console.log(auth);
      if (auth) {
        this.isAuth = true
      }

    });
    var local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

    this.myForm = this._fb.group({
      title: ['', [Validators.required]],
      subtitle: ['', [Validators.required]],
      createdDate: [local.toJSON().slice(0, 10), [Validators.required]],
      paragraphs: this._fb.array([
        this.initParagraph(),
      ])
    });
  }

  initParagraph() {
    return this._fb.group({
      paragraph: ['', Validators.required],
    });
  }

  addParagraph() {
    const control = <FormArray>this.myForm.controls['paragraphs'];
    control.push(this.initParagraph());
  }

  removeParagraph(i: number) {
    const control = <FormArray>this.myForm.controls['paragraphs'];
    control.removeAt(i);
  }

  save(form: FormGroup) {
    if (this.previewImg && this.mainImg) {
      let img = new Image();
      var sub = this.sub;
      img.onload = function () {
        if (this.width == 200 && this.height == 200) {
          sub.next(form);
        } else {
          alert("Előnézeti kép 200px*200px nek kell lennie");
        }
      };
      img.src = window.URL.createObjectURL(this.previewImg);
    } else {
      alert("Előnézeti és borító kép megadása kötelező");
    }


  }

  upload(form) {
    let model = form.value;
    let p = model.paragraphs.map(data => data.paragraph);
    let key = this.removeSpecialChars(model.title);
    let news = new News(key, model.title, model.subtitle, p, model.createdDate, this.previewImg.name, this.mainImg.name);
    var storageRef = this.firebaseApp.storage().ref();
    var promises: Array<firebase.storage.UploadTask> = [];
    let previewImg = storageRef.child(`news/${key}/${this.previewImg.name}`);
    let mainImg = storageRef.child(`news/${key}/${this.mainImg.name}`);
    promises.push(mainImg.put(this.mainImg));
    promises.push(previewImg.put(this.previewImg));
    this.files.forEach((file: File) => {
      let image = storageRef.child(`news/${key}/${file.name}`);
      promises.push(image.put(file));
    });
    Promise.all(promises).then(values => {
      news.images = this.files.map((file: File) => file.name);
      const cleanObject = _.omitBy(news, _.isNil);
      let date = new Date(news.createdDate);
      let num = date.getFullYear() + date.getDay() * 30 + date.getDay();
      this.newsService.createNews(cleanObject).setPriority(num, (data) => console.log(data));
      this.reset();
    });
  }

  onPreviewImg(event) {
    this.previewImg = event.srcElement.files[0];
  }

  onMainImg(event) {
    this.mainImg = event.srcElement.files[0];
  }

  onChange(event) {
    this.files.push(event.srcElement.files[0]);
  }

  removeSpecialChars(str: string): string {
    return str.replace(/(?!\w|\s)./g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(\s*)([\W\w]*)(\b\s*$)/g, '$2');
  }

  reset() {
    this.myForm.reset();
    this.files = [];
    this.previewImg = null;
    this.mainImg = null;
    this.imageEl.nativeElement.value = "";
    this.previewImgEl.nativeElement.value = "";
    this.mainImgEl.nativeElement.value = "";
  }

}
