
Be sure to have installed Node.js and bower in your system: 

curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g bower 

Then:
 
cd <main directory with server.js>/
npm install
npm start
 
Be shure to run Kurento media server:
sudo service kurento-media-server-6.0 start
 
