#pragma once
#include <sw/redis++/redis++.h>
#include <string>

using namespace sw::redis;

class RedisClient {
private:
    Redis redis;
    ConnectionOptions connect(const std::string& password, const std::string& host, const int& port){
        ConnectionOptions opts;
        if (password != ""){
            opts.password = password;
        }
        opts.host = host;
        opts.port = port;
        return opts;
    }
public:
    RedisClient() : redis(Redis("tcp://localhost:6379")) {}
    RedisClient(const std::string& password, const std::string& host = "localhost", const int& port = 6379) : redis(connect(password, host, port)) {}

    void ping(){
        redis.ping();
    }
    void set(const std::string& key, const std::string& value){
        redis.set(key, value);
    }
    std::string get(const std::string& key){
        return *(redis.get(key));
    }
};