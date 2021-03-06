process.env.NODE_ENV = 'test';
const db = require('../../db');
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/user');
const {
  createTables,
  insertTestData,
  dropTables
} = require('../../test_helpers/setup');

let survey1,
  survey2,
  question1,
  question2,
  user1,
  choice1,
  choice2,
  choice3,
  choice4,
  choice5,
  choice6,
  choice7,
  choice8,
  userToken,
  hackerToken;

let testUser = {
  "username": "kevin",
  "password": "kevin",
  "first_name": "kevin",
  "last_name": "kevin",
  "email": "kevin@kevin.com"
};

//Insert 2 users before each test
beforeEach(async function () {
  await createTables();

  // insert test data and store it in variables
  ({
    question1,
    question2,
    survey1,
    survey2,
    user1,
    choice1,
    choice2,
    choice3,
    choice4,
    choice5,
    choice6,
    choice7,
    choice8
  } = await insertTestData());

  let response = await request(app)
    .post('/users')
    .send({
      "username": testUser.username,
      "password": testUser.password,
      "first_name": testUser.first_name,
      "last_name": testUser.last_name,
      "email": testUser.email
    });
  userToken = response.body.token;

  let responseForHacker = await request(app)
    .post('/users')
    .send({
      "username": "hackerman",
      "password": "hackerman",
      "first_name": "hackerman",
      "last_name": "hackerman",
      "email": "hackerman@hacker.com",
    });
  hackerToken = responseForHacker.body.token;
});

// Test get surveys route
describe('GET /surveys', () => {
  it('should correctly return a list of surveys including it\'s questions', async function () {
    const response = await request(app).get('/surveys');
    expect(response.statusCode).toBe(200);
    expect(response.body.surveys.length).toBe(0);

    let survey_result = await db.query(`
    INSERT INTO surveys (author, title, description, published, category)
    VALUES ('joerocket', 'Best Books Ever', 'J.k rowling aint got shit on this', true, 'music')
    RETURNING id, author, title, description, anonymous, date_posted, category
  `);

    let survey3 = survey_result.rows[0];

    let response2 = await request(app).get('/surveys');
    expect(response2.body.surveys).toEqual(
      [{
        "_id": 3,
        "published": true,
        "anonymous": true,
        "author": survey3.author,
        "date_posted": expect.any(String),
        "description": survey3.description,
        "category": survey3.category,
        "title": survey3.title,
      },
      ]
    );
  });

  it('should be able to search for a survey by author', async function () {
    const response = await request(app).get('/surveys?search=sponge');
    expect(response.statusCode).toBe(200);
    expect(response.body.surveys.length).toBe(1);
    expect(response.body.surveys).toEqual(
      [{
        "_id": 2,
        "published": false,
        "anonymous": true,
        "author": "spongebob",
        "date_posted": expect.any(String),
        "description": "top ceos of all time",
        "category": survey2.category,
        "title": "top ceos"
      }]
    );
  });

  it('should be able to search for a survey by title', async function () {
    const response = await request(app).get('/surveys?search=albums');
    expect(response.statusCode).toBe(200);
    expect(response.body.surveys.length).toBe(1);
    expect(response.body.surveys).toEqual(
      [{
        "_id": 1,
        "published": false,
        "anonymous": true,
        "author": "joerocket",
        "date_posted": expect.any(String),
        "description": "hot fiya",
        "category": survey1.category,
        "title": "best albums of 2009"
      }]
    );
  });

  it('should be able to search for a survey by description', async function () {
    const response = await request(app).get('/surveys?search=ceos+of+all');
    expect(response.statusCode).toBe(200);
    expect(response.body.surveys.length).toBe(1);
    expect(response.body.surveys).toEqual(
      [{
        "_id": 2,
        "published": false,
        "anonymous": true,
        "author": "spongebob",
        "date_posted": expect.any(String),
        "description": "top ceos of all time",
        "category": survey2.category,
        "title": "top ceos"
      }]
    );
  });
});

describe('GET /surveys/:id', () => {
  it('should return details for a survey', async function () {
    const response = await request(app).get(`/surveys/${survey1.id}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.survey).toEqual({
      _id: expect.any(Number),
      published: false,
      author: 'joerocket',
      title: 'best albums of 2009',
      description: 'hot fiya',
      category: survey1.category,
      date_posted: expect.any(String),
      anonymous: true,
      questions: [{
        "_id": 1,
        "_survey_id": 1,
        "title": "Favorite EDM Artist",
        "question_type": "multiple"
      }]
    })
  });

  it('should return a 404 Not Found if id not found', async function () {
    const response = await request(app).get('/surveys/33797');
    expect(response.statusCode).toBe(404);
  })
})

describe('POST /surveys', () => {
  it('should create a new survey', async function () {
    let response = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(response.body).toEqual({
      survey: {
        _id: 3,
        published: false,
        author: testUser.username,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
        date_posted: expect.any(String),
        anonymous: true
      }
    });

    const patchResponse = await request(app)
      .patch(`/surveys/${response.body.survey._id}`)
      .send({
        _token: userToken,
        published: true
      });

    response = await request(app).get('/surveys');
    expect(response.body.surveys.length).toBe(1);
  })

  it('should give 400 error for missing title', async function () {
    const response = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(response.status).toEqual(400);
  });

  it('should not authorize if not logged in or bad token', async function () {
    const response = await request(app)
      .post('/surveys')
      .send({
        _token: userToken.concat("3s8sd3"),
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(response.status).toEqual(401);
  });
})


describe('PATCH /surveys/:id', () => {
  it('Should update the title of a survey only', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
        title: '__muchbetter__',
        category: 'music',
      });

    expect(patchResponse.status).toEqual(200);
    expect(patchResponse.body.survey.description).toEqual('9999ThisIsDescriptive9999');
    expect(patchResponse.body.survey.title).toEqual('__muchbetter__');
  });

  it('Should allow a user to publish a survey via patch', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
        published: true
      });

    expect(patchResponse.status).toEqual(200);
    expect(patchResponse.body.survey.published).toEqual(true);
  });

  it('Should update the description of a survey only', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
        description: '__muchbetter__'
      });

    expect(patchResponse.body.survey.author).toEqual(testUser.username);
    expect(patchResponse.body.survey.description).toEqual('__muchbetter__');
    expect(patchResponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');
  });



  it('Should update the title and description of a survey only', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
        description: '__muchbetter__',
        title: '__bettertitle__'
      });

    expect(patchResponse.body.survey.author).toEqual(testUser.username);
    expect(patchResponse.body.survey.description).toEqual('__muchbetter__');
    expect(patchResponse.body.survey.title).toEqual('__bettertitle__');
  });



  it('Should ignore all invalid or immutable fields', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
        author: 'hackerman',
        notdescription: '__muchbetter__',
        title: '__bettertitle__'
      });

    expect(patchResponse.status).toBe(400);
  });

  it('Should not authorize to update if survey owned by other user', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    /** Try to edit a survey whose author is "kevin" with the token for "hackerman" */
    const patchResponse = await request(app)
      .patch(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: hackerToken,
        author: 'hackerman',
        notdescription: '__muchbetter__',
        title: '__bettertitle__'
      });

    expect(patchResponse.status).toEqual(401);
    expect(patchResponse.body.error).toEqual("Unauthorized");
  });
})

describe('DELETE /surveys/:id', () => {
  it('Should delete a survey', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    const deleteResponse = await request(app)
      .delete(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: userToken,
      });

    expect(deleteResponse.status).toEqual(200);
    expect(deleteResponse.body).toEqual("Deleted");

    const getResponse = await request(app)
      .get(`/surveys/${postReponse.body.survey._id}`)

    expect(getResponse.status).toBe(404);
  });


  it('Should not authorize to delete if survey owned by other user', async function () {
    // first create a new survey by testUser
    const postReponse = await request(app)
      .post('/surveys')
      .send({
        _token: userToken,
        title: 'xxSuperCoolTestSurveyxx',
        description: '9999ThisIsDescriptive9999',
        category: 'music',
      });

    expect(postReponse.body.survey.title).toEqual('xxSuperCoolTestSurveyxx');

    /** Try to delete a survey whose author is "kevin" with the token for "hackerman" */
    const deleteResponse = await request(app)
      .delete(`/surveys/${postReponse.body.survey._id}`)
      .send({
        _token: hackerToken
      });

    expect(deleteResponse.status).toEqual(401);
    expect(deleteResponse.body.error).toEqual("Unauthorized");
  });
})

// Test Generic 404 catcher
describe('GET /fakeaddress', () => {
  it('should not allow us to go to a fake address', async function () {
    const response = await request(app).get('/fakeaddress');

    expect(response.status).toEqual(404);
    expect(response.body.error).toEqual("Not Found");
  });
});

//Delete tables after each tets
afterEach(async function () {
  await dropTables();
});

//Close db connection
afterAll(async function () {
  await db.end();
});
