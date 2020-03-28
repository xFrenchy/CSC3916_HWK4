var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./Movies'); //I added this to make my own schema for movies in that file
var Review = require('./Reviews');
var jwt = require('jsonwebtoken');
var cors = require('cors');

var app = express();
module.exports = app; // for testing
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    var userNew = new User();
    //userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        user.comparePassword(userNew.password, function(isMatch){
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, message: 'Authentication failed. Username/Password is wrong'});
            }
        });


    });
});

router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        //Figure out if post needs jwt
        //If there is a tittle, there exists a year released, there exists a genre
        if (req.body.title || req.body.year_released || req.body.genre){
            //check if the actor name array and character name array are at least of size 3
            //https://stackoverflow.com/questions/15209136/how-to-count-length-of-the-json-array-element    <- find length of json array
          if(Object.keys(req.body.actor_name).length < 3 || Object.keys(req.body.character_name).length < 3){
              res.json({success: false, message: 'actor name and character name array needs to contain at least 3 items'});
            }
          else {
              //length is greater than 3, time to save the movie
              var movies = new Movie();
              //enter all the data in the movie schema
              movies.title = req.body.title;
              movies.year_released = req.body.year_released;
              movies.genre = req.body.genre;
              movies.actor_name = req.body.actor_name;
              movies.character_name = req.body.character_name;
              //try to save the movie schema into our database
              movies.save(function (err) {
                  if (err) {
                      return res.send(err);
                  }
                  else {
                      res.status(200).send({
                          status: 200,
                          msg: 'movie saved',
                          headers: req.headers,
                          query: req.query,
                          env: process.env.UNIQUE_KEY
                      });
                  }
              });
          }
        }
        else{
            res.json({success: false, message: 'Please pass title, year_released, genre, and actors.'});
        }
    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        //https://stackoverflow.com/questions/33028273/how-to-get-mongoose-to-list-all-documents-in-the-collection-to-tell-if-the-coll
        Movie.find(function (err, result) {
            if (err) {
                return res.send(err);
            }
            else{
                res.send(result);
            }
        });
        //res.send(Movie.find());
        //res.status(200).send({status: 200, msg: 'GET movies', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY, result: find_result});
    })
    .put(authJwtController.isAuthenticated, function (req, res) {
        if(Object.keys(req.body.updatingJson).length == 2){
            var movie_arrray = req.body.updatingJson;
            var movie_title = movie_arrray[0].title;
          Movie.findOne({title: movie_title}, function (err, result) {
              if (err) {
                  return res.send(err);
              }
              else{
                  if(result == null){
                      res.send("No matches found!");
                  }
                  else{
                      result.title = req.body.new_title;
                      //https://stackoverflow.com/questions/40466323/mongoose-model-update-only-update-provided-values
                      Movie.update({title: movie_title}, movie_arrray[1], function (err, raw) {
                          if(err){
                              res.send(err);
                          }
                          res.send("Movie succefully updated");
                      });
                  }
              }
          })
        }
        else{
            res.send("Please enter a title to search for and a new title to replace it with");
        }
        //res.status(200).send({status: 200, msg: 'movie updated', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY});
    })
    .delete(authJwtController.isAuthenticated, function(req,res){
        if(req.body.title){
            Movie.deleteOne({title: req.body.title}, function (err, raw) {
                if(err){
                    res.send(err);
                }
                res.send("Movie succefully deleted! Bye movie :(");
            });
        }
        else{
            res.send("Please enter a title to search for");
        }
        //res.status(200).send({status: 200, msg: 'movie deleted', headers: req.headers, query: req.query, env: process.env.UNIQUE_KEY});
    })
    .all(function (req, res) {
        res.status(405).send({msg: 'this method is not supported'});
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
